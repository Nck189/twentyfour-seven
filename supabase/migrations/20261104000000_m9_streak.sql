-- M9: streak (SPEC §8.7) settled server-side, with the Perfect day / streak milestone tickets
-- (SPEC §8.5) through the existing ticket_grants ledger. Rules mirror lib/game/streak.ts and
-- content/game.ts STREAK_RULES (a unit test checks the numbers; an integration test the parity).
-- First, close the "excuse it afterwards" holes (G7 R-M6-4, R-M6-R1) the streak would otherwise pay for.

-- ---------- guards ----------
-- A block can't be tagged a planned deviation after its day (it would erase a miss after the fact).
create or replace function public.block_logs_planned_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user = 'service_role' then
    return new;
  end if;
  if new.planned_deviation and (tg_op = 'INSERT' or not old.planned_deviation)
     and new.date < public._wake_day(new.user_id) then
    raise exception 'a past block can''t be tagged as planned' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger block_logs_planned_guard before insert or update of planned_deviation on public.block_logs
  for each row execute function public.block_logs_planned_guard();

-- Vacation/Sick can't be set for a day that's over; "Out late" can't be set once that night is
-- well past (an hour of slack for setting it on the way out).
create or replace function public.day_plans_past_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date;
begin
  if current_user = 'service_role' then
    return new;
  end if;
  today := public._wake_day(new.user_id);
  if new.date < today and coalesce(new.mode, 'normal') is distinct from
     (case when tg_op = 'UPDATE' then coalesce(old.mode, 'normal') else 'normal' end) then
    raise exception 'Vacation/Sick can''t be set for a past day' using errcode = '22023';
  end if;
  if new.late_night is not null
     and (tg_op = 'INSERT' or new.late_night is distinct from old.late_night)
     and (new.late_night ->> 'return_at') is not null
     and (new.late_night ->> 'return_at')::timestamptz < now() - interval '1 hour' then
    raise exception 'that night is already over' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger day_plans_past_guard before insert or update on public.day_plans
  for each row execute function public.day_plans_past_guard();

-- ---------- the settled days (read-only for clients) ----------
create table public.day_results (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('perfect', 'minimum', 'frozen', 'paused', 'missed')),
  oee real,
  at timestamptz not null default now(),
  primary key (user_id, date)
);
alter table public.day_results enable row level security;
alter table public.day_results force row level security;
create policy "own rows: select" on public.day_results for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.day_results from anon, authenticated;
grant select on public.day_results to authenticated;

-- Day OEE (lib/game/outcome.ts dayOee): Availability × Performance × Quality over the blocks not
-- tagged as planned. Null on Vacation/Sick days.
create or replace function public._day_oee(uid uuid, d date)
returns real
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  k text;
  lg public.block_logs;
  planned integer := 0;
  on_time integer := 0;
  first10 integer := 0;
  done integer := 0;
  items integer := 0;
  m text;
begin
  select mode into m from public.day_plans where user_id = uid and date = d;
  if coalesce(m, 'normal') <> 'normal' then
    return null;
  end if;
  foreach k in array array['down', 'sleep', 'wake', 'focus', 'work', 'gradation', 'free'] loop
    select * into lg from public.block_logs where user_id = uid and date = d and block = k;
    if lg.id is not null and lg.planned_deviation then
      continue;
    end if;
    planned := planned + 1;
    if lg.id is null then
      continue;
    end if;
    if not lg.backfilled and lg.planned_start is not null and lg.started_at is not null
       and abs(extract(epoch from lg.started_at - lg.planned_start)) <= 600 then
      on_time := on_time + 1;
    end if;
    if not lg.backfilled and lg.first10_at is not null then
      first10 := first10 + 1;
    end if;
    if lg.items_planned > 0 then
      items := items + lg.items_planned;
      done := done + least(case when jsonb_typeof(lg.items_done) = 'array'
                                then jsonb_array_length(lg.items_done) else 0 end, lg.items_planned);
    end if;
  end loop;
  if planned = 0 then
    return null;
  end if;
  return (on_time::real / planned)
       * (case when items > 0 then done::real / items else 1 end)
       * (first10::real / planned);
end $$;

-- Settles every finished wake-day since the last one (at most 60 days back, never before sign-up):
-- paused (Vacation/Sick) · perfect/minimum ("I'm up" in the window + the Night ticket, or a planned
-- late night; perfect = Day OEE ≥ 0.8) · frozen (a scarecrow used) · missed (streak to 0).
-- A scarecrow is earned every 7 days of streak (max 2). Tickets: Perfect day +1, streak 7/14/30 +5.
create or replace function public.settle_days()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  gs public.game_state;
  tz text;
  today date;
  d date;
  first_day date;
  m text;
  is_min boolean;
  o real;
  k text;
  settled jsonb := '[]'::jsonb;
  granted jsonb := '[]'::jsonb;
  v_streak integer;
  v_best integer;
  v_freezes integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into gs from public.game_state where user_id = uid for update;
  if not found then
    raise exception 'no game state' using errcode = 'P0002';
  end if;
  select timezone into tz from public.profiles where user_id = uid;
  today := public._wake_day(uid);
  select greatest(
           coalesce((select max(r.date) + 1 from public.day_results r where r.user_id = uid),
                    (select (p.created_at at time zone coalesce(tz, 'Asia/Bangkok'))::date
                       from public.profiles p where p.user_id = uid)),
           today - 60)
    into first_day;
  v_streak := gs.streak;
  v_best := gs.best_streak;
  v_freezes := gs.freezes;

  d := first_day;
  while d < today loop
    select mode into m from public.day_plans where user_id = uid and date = d;
    if coalesce(m, 'normal') <> 'normal' then
      k := 'paused';
      o := null;
    else
      is_min := exists (select 1 from public.wake_events w
                        where w.user_id = uid and w.date = d and w.in_window and not w.backfilled)
            and (exists (select 1 from public.ticket_grants g
                         where g.user_id = uid and g.reason = 'night' and g.ref_date = d)
                 or exists (select 1 from public.day_plans p
                            where p.user_id = uid and p.date = d + 1 and p.late_night is not null));
      o := public._day_oee(uid, d);
      if is_min then
        k := case when o is not null and o >= 0.8 then 'perfect' else 'minimum' end;
        v_streak := v_streak + 1;
        v_best := greatest(v_best, v_streak);
        if v_streak % 7 = 0 then
          v_freezes := least(2, v_freezes + 1);
        end if;
        if v_streak in (7, 14, 30) and public._grant_once(uid, 'streak_' || v_streak, d, 5) then
          granted := granted || jsonb_build_object('reason', 'streak_' || v_streak, 'date', d, 'amount', 5);
        end if;
        if k = 'perfect' and public._grant_once(uid, 'perfect_day', d, 1) then
          granted := granted || jsonb_build_object('reason', 'perfect_day', 'date', d, 'amount', 1);
        end if;
      elsif v_freezes > 0 then
        k := 'frozen';
        v_freezes := v_freezes - 1;
      else
        k := 'missed';
        v_streak := 0;
      end if;
    end if;
    insert into public.day_results (user_id, date, kind, oee) values (uid, d, k, o)
    on conflict do nothing;
    settled := settled || jsonb_build_object('date', d, 'kind', k);
    d := d + 1;
  end loop;

  update public.game_state set streak = v_streak, best_streak = v_best, freezes = v_freezes
  where user_id = uid;
  if jsonb_array_length(settled) > 0 then
    insert into public.events (user_id, type, payload)
    values (uid, 'days_settled', jsonb_build_object('days', settled, 'tickets', granted));
  end if;
  return jsonb_build_object('settled', settled, 'granted', granted, 'streak', v_streak,
                            'best', v_best, 'freezes', v_freezes, 'today', today);
end $$;

-- Settled days are server-only events.
drop policy if exists "own rows: insert" on public.events;
create policy "own rows: insert" on public.events for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and type not in ('ticket_granted', 'wake_pressed', 'wake_backfilled', 'night_ritual_completed',
                     'gacha_pull', 'coins_granted', 'essence_granted', 'egg_hatched', 'harvest',
                     'seed_planted', 'decor_bought', 'star_up', 'unlock_granted',
                     'exercise_logged', 'animal_petted', 'produce_collected', 'animal_fed',
                     'days_settled')
  );

revoke all on function public.block_logs_planned_guard() from public, anon, authenticated;
revoke all on function public.day_plans_past_guard() from public, anon, authenticated;
revoke all on function public._day_oee(uuid, date) from public, anon, authenticated;
grant execute on function public._day_oee(uuid, date) to service_role;
revoke all on function public.settle_days() from public, anon;
grant execute on function public.settle_days() to authenticated;
