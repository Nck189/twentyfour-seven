-- M9: streak (SPEC §8.7) settled server-side, with the Perfect day / streak milestone tickets
-- (SPEC §8.5) through the existing ticket_grants ledger. Rules mirror lib/game/streak.ts and
-- content/game.ts STREAK_RULES (a unit test checks the numbers; an integration test the parity).
-- First, close the "excuse it afterwards" holes (G7 R-M6-4, R-M6-R1) the streak would otherwise pay for.

-- ---------- guards ----------
-- The wake-day a pressed "I'm up" started stays started: a later template or plan edit can't
-- move today back to yesterday (G7 R-M9-R2; the freeze skips pressed days).
create or replace function public._wake_day(uid uuid)
returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  tz text;
  d date;
  w timestamptz;
begin
  select timezone into tz from public.profiles where user_id = uid;
  d := (now() at time zone coalesce(tz, 'Asia/Bangkok'))::date;
  w := coalesce(
    (select target_wake from public.wake_events where user_id = uid and date = d),
    (select target_wake from public.wake_snapshots where user_id = uid and date = d),
    public._target_wake(uid, d));
  if w is not null and now() < w then
    return d - 1;
  end if;
  return d;
end $$;

-- A day plan or a check-in can't be moved to another day, user or block (G7 R-M9-R1: moving a
-- future Sick day or today's logs onto yesterday skipped every past-day rule). Upserts that set
-- the same keys are fine.
create or replace function public.day_keys_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'service_role' or current_setting('role', true) = 'service_role' then
    return new;
  end if;
  if new.user_id is distinct from old.user_id or new.date is distinct from old.date
     or (tg_table_name = 'block_logs' and (to_jsonb(new) ->> 'block') is distinct from (to_jsonb(old) ->> 'block')) then
    raise exception 'a day can''t be moved; delete it and add it again' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger day_keys_guard before update on public.day_plans
  for each row execute function public.day_keys_guard();
create trigger day_keys_guard before update on public.block_logs
  for each row execute function public.day_keys_guard();

-- "Past" is judged by the wake-day, so the wake-day must never move backwards (G7 R-M9-3): a
-- timezone change that would make a finished day "today" again is refused until the next wake.
create or replace function public.profiles_timezone_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.timezone is distinct from old.timezone
     and not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'unknown timezone' using errcode = '22023';
  end if;
  if new.timezone is distinct from old.timezone then
    perform set_config('app.wake_day_before', public._wake_day(new.user_id)::text, true);
  end if;
  return new;
end $$;

create or replace function public.profiles_timezone_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user = 'service_role' or current_setting('role', true) = 'service_role' then
    return null;
  end if;
  if new.timezone is distinct from old.timezone
     and public._wake_day(new.user_id) < nullif(current_setting('app.wake_day_before', true), '')::date then
    raise exception 'this timezone would reopen a finished day; switch after your next wake'
      using errcode = '22023';
  end if;
  return null;
end $$;
create trigger profiles_timezone_after after update of timezone on public.profiles
  for each row execute function public.profiles_timezone_after();

-- A block can't be tagged a planned deviation after its day (it would erase a miss after the fact).
create or replace function public.block_logs_planned_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user = 'service_role' or current_setting('role', true) = 'service_role' then
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

-- A check-in written for a wake-day that's already over is a backfill, even with fresh times
-- (G7 R-M9-4: yesterday's 7 logs written the next morning looked live). A planned start that
-- isn't on the log's own day doesn't count either. Closing or ticking items on an earlier log
-- later is fine (the end of a block often comes after the next wake).
create or replace function public.block_logs_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  grace interval := interval '10 minutes';
  is_backfill boolean := false;
  tz text;
  today date;
  day_start timestamptz;
begin
  -- Admin (service role) may write logs as they are, e.g. to set up a past week in a test.
  if current_user = 'service_role' or current_setting('role', true) = 'service_role' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.backfilled then
    new.backfilled := true;
  end if;
  select timezone into tz from public.profiles where user_id = new.user_id;
  tz := coalesce(tz, 'Asia/Bangkok');
  today := (now() at time zone tz)::date;
  -- G7 R-M6-1: no check-ins for a day that hasn't come (they'd count as live when it does).
  if new.date > today then
    raise exception 'a check-in can''t be for a future day' using errcode = '22023';
  end if;
  if new.date < today - 1 then
    is_backfill := true;
  end if;
  if new.date < public._wake_day(new.user_id)
     and (tg_op = 'INSERT'
          or new.started_at is distinct from old.started_at
          or new.first10_at is distinct from old.first10_at
          or new.planned_start is distinct from old.planned_start) then
    is_backfill := true;
  end if;
  day_start := new.date::timestamp at time zone tz;
  if new.planned_start is not null
     and (tg_op = 'INSERT' or new.planned_start is distinct from old.planned_start)
     and new.planned_start not between day_start - interval '6 hours' and day_start + interval '36 hours' then
    is_backfill := true;
  end if;
  if new.started_at is not null and (tg_op = 'INSERT' or new.started_at is distinct from old.started_at)
     and abs(extract(epoch from (now() - new.started_at))) > extract(epoch from grace) then
    is_backfill := true;
  end if;
  if new.first10_at is not null and (tg_op = 'INSERT' or new.first10_at is distinct from old.first10_at)
     and abs(extract(epoch from (now() - new.first10_at))) > extract(epoch from grace) then
    is_backfill := true;
  end if;
  if new.closed_at is not null and (tg_op = 'INSERT' or new.closed_at is distinct from old.closed_at)
     and abs(extract(epoch from (now() - new.closed_at))) > extract(epoch from grace) then
    is_backfill := true;
  end if;
  if is_backfill then
    new.backfilled := true;
  end if;
  return new;
end $$;

-- When "Out late" was last set (server time; whatever a client sends is ignored, like
-- wake_planned_at). Only a late night saved before that night is over counts (G7 R-M9-1).
-- Late nights saved before this migration were judged by the old rule: they keep counting
-- (the default fills existing rows without running any trigger; new rows are stamped; a stamp
-- on a row with no late night means nothing). G7 R-M9-R4.
alter table public.day_plans add column late_night_set_at timestamptz default '-infinity';
alter table public.day_plans alter column late_night_set_at drop default;

create or replace function public._stamp_late_night()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Admin (service role) may set it directly, e.g. to set up a test.
  if (current_user = 'service_role' or current_setting('role', true) = 'service_role')
     and new.late_night_set_at is not null then
    return new;
  end if;
  if tg_op = 'INSERT' or new.late_night is distinct from old.late_night then
    new.late_night_set_at := case when new.late_night is not null then now() end;
  else
    new.late_night_set_at := old.late_night_set_at;
  end if;
  return new;
end $$;
create trigger stamp_late_night before insert or update on public.day_plans
  for each row execute function public._stamp_late_night();

-- The night before wake-day p_date is over 1 h before that wake (when the Night ticket window
-- closes; the wake as pressed, else as frozen, else as planned), and at 06:00 at the latest.
create or replace function public._night_over_at(uid uuid, p_date date)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select least(
    coalesce(
      (select w.target_wake from public.wake_events w where w.user_id = uid and w.date = p_date),
      (select s.target_wake from public.wake_snapshots s where s.user_id = uid and s.date = p_date),
      public._target_wake(uid, p_date)) - interval '1 hour',
    (p_date + time '06:00') at time zone coalesce(
      (select timezone from public.profiles where user_id = uid), 'Asia/Bangkok'));
$$;

-- Out late the night after wake-day d (saved on d + 1's plan, before that night was over).
create or replace function public._late_night_planned(uid uuid, d date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.day_plans p
    where p.user_id = uid and p.date = d + 1 and p.late_night is not null
      and p.late_night_set_at is not null
      and p.late_night_set_at <= public._night_over_at(uid, d + 1));
$$;

-- The farm honours only a late night saved in time, like the streak (G7 R-M9-1).
create or replace function public._plot_ripe(uid uuid, p public.plots, p_today date)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  need smallint := public._crop_grow_days(p.crop_id);
  d date;
  growth integer := 0;
  weeds boolean := false;
  streak integer := 0;
  lg public.block_logs;
  md text;
  r text;
begin
  if need is null or p.planted_on is null then
    return false;
  end if;
  d := greatest(p.planted_on, coalesce(p.harvested_on, p.planted_on)) + 1;
  while d <= p_today loop
    select * into lg from public.block_logs where user_id = uid and date = d and block = p.slot;
    select mode into md from public.day_plans where user_id = uid and date = d;
    r := public._block_result(lg, md, d = p_today);
    -- A planned late night (out late before d + 1, saved before that night) excuses that evening's
    -- Free (G7 R-M6-2, R-M9-1).
    if r in ('miss', 'partial') and p.slot = 'free'
       and public._late_night_planned(uid, d) then
      r := 'excused';
    end if;
    if r = 'success' then
      streak := 0;
      if not weeds then
        growth := growth + 1;
        if growth >= need then
          return true;
        end if;
      end if;
    elsif r = 'miss' then
      weeds := true;
      streak := streak + 1;
      if streak >= 5 then
        return false; -- dead
      end if;
      d := d + 1;
      continue; -- fresh weeds don't clear the same day
    elsif r in ('partial', 'backfilled') then
      streak := 0;
    end if;
    -- Minimum day: a live in-window "I'm up" + the Night ticket for that day.
    if weeds and r <> 'open'
       and exists (select 1 from public.wake_events
                   where user_id = uid and date = d and in_window and not backfilled)
       and exists (select 1 from public.ticket_grants
                   where user_id = uid and reason = 'night' and ref_date = d) then
      weeds := false;
    end if;
    d := d + 1;
  end loop;
  return false;
end $$;

-- Vacation/Sick can't be set for a day that's over; "Out late" can't be set once that night is
-- over (by server time, never the return time the client sends) and needs a return time.
create or replace function public.day_plans_past_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date;
  ret timestamptz;
  tz text;
begin
  if current_user = 'service_role' or current_setting('role', true) = 'service_role' then
    return new;
  end if;
  today := public._wake_day(new.user_id);
  if new.date < today and coalesce(new.mode, 'normal') is distinct from
     (case when tg_op = 'UPDATE' then coalesce(old.mode, 'normal') else 'normal' end) then
    raise exception 'Vacation/Sick can''t be set for a past day' using errcode = '22023';
  end if;
  if new.late_night is not null
     and (tg_op = 'INSERT' or new.late_night is distinct from old.late_night) then
    begin
      ret := (new.late_night ->> 'return_at')::timestamptz;
    exception when others then
      ret := null;
    end;
    if ret is null then
      raise exception 'a late night needs a return time' using errcode = '22023';
    end if;
    -- Home between noon the day before and noon of that day (how Plan sets it), G7 R-M9-R3.
    tz := coalesce((select timezone from public.profiles where user_id = new.user_id), 'Asia/Bangkok');
    if ret < ((new.date - 1) + time '12:00') at time zone tz
       or ret >= (new.date + time '12:00') at time zone tz then
      raise exception 'the return time must be on that night' using errcode = '22023';
    end if;
    if ret < now() - interval '1 hour' or now() > public._night_over_at(new.user_id, new.date) then
      raise exception 'that night is already over' using errcode = '22023';
    end if;
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
-- paused (Vacation/Sick, or "I'm up" in the window after a planned late night with no ritual) ·
-- perfect/minimum ("I'm up" in the window + the Night ticket; perfect = Day OEE ≥ 0.8) ·
-- frozen (a scarecrow used) · missed (streak to 0).
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
  is_wake boolean;
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
                    -- The sign-up day counts only if it had a wake (signing up at 14:00 isn't a miss).
                    (select c.d + case when exists (select 1 from public.wake_events w
                                                     where w.user_id = uid and w.date = c.d) then 0 else 1 end
                       from (select (p.created_at at time zone coalesce(tz, 'Asia/Bangkok'))::date as d
                               from public.profiles p where p.user_id = uid) c)),
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
      is_wake := exists (select 1 from public.wake_events w
                         where w.user_id = uid and w.date = d and w.in_window and not w.backfilled);
      is_min := is_wake
            and exists (select 1 from public.ticket_grants g
                        where g.user_id = uid and g.reason = 'night' and g.ref_date = d);
      o := public._day_oee(uid, d);
      if not is_min and is_wake and public._late_night_planned(uid, d) then
        -- A planned late night: no penalty, but no +1 either (SPEC §8.4, G7 R-M9-2).
        k := 'paused';
      elsif is_min then
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
revoke all on function public.block_logs_guard() from public, anon, authenticated;
revoke all on function public.day_keys_guard() from public, anon, authenticated;
revoke all on function public.profiles_timezone_guard() from public, anon, authenticated;
revoke all on function public.profiles_timezone_after() from public, anon, authenticated;
revoke all on function public._stamp_late_night() from public, anon, authenticated;
revoke all on function public._night_over_at(uuid, date) from public, anon, authenticated;
revoke all on function public._late_night_planned(uuid, date) from public, anon, authenticated;
revoke all on function public._plot_ripe(uuid, public.plots, date) from public, anon, authenticated;
revoke all on function public._day_oee(uuid, date) from public, anon, authenticated;
grant execute on function public._day_oee(uuid, date) to service_role;
revoke all on function public.settle_days() from public, anon;
grant execute on function public.settle_days() to authenticated;

-- ---------- seasons (SPEC §8.8): festival decor only in its month ----------
create or replace function public._decor_price(p_item text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_item when 'fence' then 40 when 'path' then 30 when 'flowers' then 50 when 'pond' then 300
    when 'fireworks' then 60 when 'red_lantern' then 80 when 'water_bowl' then 70 when 'jasmine' then 60
    when 'krathong' then 90 when 'star_tree' then 120 end;
$$;

-- The month (1–12) a festival decor item is sold in; null = always (content/seasons.ts).
create or replace function public._festival_month(p_item text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_item when 'fireworks' then 1 when 'red_lantern' then 2 when 'water_bowl' then 4
    when 'jasmine' then 8 when 'krathong' then 11 when 'star_tree' then 12 end;
$$;

create or replace function public.buy_decor(p_item text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  price integer := public._decor_price(p_item);
  month integer := public._festival_month(p_item);
  left_coins integer;
  n integer;
  item public.decor;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if price is null then
    raise exception 'unknown item' using errcode = '22023';
  end if;
  -- The wake-day's month, the same day the app shows (R-M9-9: the 1st before wake is still the
  -- last day of the old month).
  if month is not null then
    if extract(month from public._wake_day(uid))::integer <> month then
      raise exception 'not in season' using errcode = 'P0001';
    end if;
  end if;
  update public.game_state set coins = coins - price
  where user_id = uid and coins >= price
  returning coins into left_coins;
  if not found then
    raise exception 'not enough coins' using errcode = 'P0001';
  end if;
  select count(*) into n from public.decor where user_id = uid and item_id = p_item;
  insert into public.decor (user_id, item_id, x, y) values (uid, p_item, n, 0) returning * into item;
  insert into public.events (user_id, type, payload)
  values (uid, 'decor_bought', jsonb_build_object('item', p_item, 'price', price));
  return jsonb_build_object('id', item.id, 'item', p_item, 'coins', left_coins);
end $$;
revoke all on function public._festival_month(text) from public, anon, authenticated;
revoke all on function public._decor_price(text) from public, anon, authenticated;
revoke all on function public.buy_decor(text) from public, anon;
grant execute on function public.buy_decor(text) to authenticated;


-- ---------- unlock ladder (SPEC §8.8b) ----------
create or replace function public._setup_reward(p_id text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case p_id
    when 'sleep_times' then '{"seed": {"crop": "strawberry", "n": 2}}'::jsonb
    when 'first10' then '{"tickets": 1}'::jsonb
    when 'checklist' then '{"coins": 20}'::jsonb
    when 'backlog_estimate' then '{"coins": 15}'::jsonb
    when 'language' then '{"coins": 5}'::jsonb
    when 'home_screen' then '{"decor": "flowers"}'::jsonb
    when 'exercise' then '{"feed": 3}'::jsonb
    -- unlock ladder (SPEC §8.8b, content/unlocks.ts UNLOCKS)
    when 'first_night' then '{"decor": "garden_lantern"}'::jsonb
    when 'first_backlog' then '{"decor": "mailbox"}'::jsonb
    when 'all_first10_day' then '{"seed": {"crop": "sunflower", "n": 1}}'::jsonb
    when 'first10_20' then '{"tickets": 2}'::jsonb
    when 'must_10' then '{"coins": 50}'::jsonb
    when 'streak_7' then '{"egg": 1}'::jsonb
    when 'streak_30' then '{"decor": "pond"}'::jsonb
    when 'blocks_100' then '{"coins": 150}'::jsonb
  end
$$;

create or replace function public._grant_unlock(uid uuid, p_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  reward jsonb := public._setup_reward(p_id);
  inserted integer;
  n integer;
  roll jsonb;
begin
  if reward is null then
    raise exception 'unknown unlock' using errcode = '22023';
  end if;
  insert into public.unlock_grants (user_id, unlock_id, reward) values (uid, p_id, reward)
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return false;
  end if;
  if reward ? 'tickets' then
    update public.game_state set tickets = tickets + (reward ->> 'tickets')::integer where user_id = uid;
  end if;
  if reward ? 'coins' then
    update public.game_state set coins = coins + (reward ->> 'coins')::integer where user_id = uid;
  end if;
  if reward ? 'seed' then
    insert into public.inventory (user_id, item_id, qty)
    values (uid, 'seed:' || (reward -> 'seed' ->> 'crop'), (reward -> 'seed' ->> 'n')::integer)
    on conflict (user_id, item_id) do update set qty = public.inventory.qty + excluded.qty;
  end if;
  if reward ? 'feed' then
    insert into public.inventory (user_id, item_id, qty) values (uid, 'feed', (reward ->> 'feed')::integer)
    on conflict (user_id, item_id) do update set qty = public.inventory.qty + excluded.qty;
  end if;
  if reward ? 'egg' then
    roll := public._hatch_roll(random(), random());
    insert into public.animals (user_id, species, fed_until)
    values (uid, roll ->> 'species', public._add_feed(null, 2));
    insert into public.events (user_id, type, payload)
    values (uid, 'egg_hatched', jsonb_build_object('species', roll ->> 'species', 'rarity', roll ->> 'rarity', 'unlock', p_id));
  end if;
  if reward ? 'decor' then
    select count(*) into n from public.decor where user_id = uid and item_id = reward ->> 'decor';
    insert into public.decor (user_id, item_id, x, y) values (uid, reward ->> 'decor', n, 0);
  end if;
  insert into public.events (user_id, type, payload)
  values (uid, 'unlock_granted', jsonb_build_object('unlock', p_id, 'reward', reward));
  return true;
end $$;

-- ---------- backlog: remember the priority a task was paid as (G7 R-M9-5) ----------
-- The Must unlock counted a task's current priority, so relabelling done tasks paid it.
alter table public.coin_grants add column paid_as text
  check (paid_as is null or paid_as in ('must', 'should', 'just_start'));
-- Earlier grants: 30 coins was only ever paid for a Must at full rate.
update public.coin_grants set paid_as = case amount when 30 then 'must' when 20 then 'should' else 'just_start' end
where reason = 'backlog_done' and paid_as is null;

create or replace function public.complete_backlog_item(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  item public.backlog_items;
  amount integer;
  paid_as text;
  inserted integer;
  earned_today integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  perform 1 from public.game_state where user_id = uid for update;
  select * into item from public.backlog_items where id = p_id and user_id = uid for update;
  if not found then
    raise exception 'backlog item not found' using errcode = 'P0002';
  end if;
  if item.status = 'dropped' then
    return jsonb_build_object('coins_granted', 0);
  end if;
  update public.backlog_items
     set status = 'done', done_at = coalesce(done_at, now())
   where id = p_id;

  amount := case item.priority when 'must' then 30 when 'should' then 20 else 10 end;
  paid_as := item.priority;
  if now() - item.created_at < interval '10 minutes'
     or now() - item.priority_set_at < interval '10 minutes' then
    amount := least(amount, 10);
    paid_as := 'just_start';
  end if;

  -- Rolling 24 h (no local midnight to move by switching zones).
  select coalesce(sum(g.amount), 0) into earned_today
    from public.coin_grants g
   where g.user_id = uid and g.reason = 'backlog_done' and g.at > now() - interval '24 hours';
  amount := least(amount, greatest(0, 150 - earned_today));
  if amount <= 0 then
    return jsonb_build_object('coins_granted', 0, 'capped', true);
  end if;

  insert into public.coin_grants (user_id, reason, ref, amount, paid_as)
  values (uid, 'backlog_done', p_id::text, amount, paid_as)
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return jsonb_build_object('coins_granted', 0);
  end if;

  update public.game_state set coins = coins + amount where user_id = uid;
  insert into public.events (user_id, type, payload)
  values (uid, 'coins_granted', jsonb_build_object('amount', amount, 'reason', 'backlog_done', 'item', p_id));
  return jsonb_build_object('coins_granted', amount);
end $$;
revoke all on function public.complete_backlog_item(uuid) from public, anon;
grant execute on function public.complete_backlog_item(uuid) to authenticated;

-- What the ladder counts, from server facts or guarded logs.
create or replace function public._unlock_counts(uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'nights', (select count(*) from public.ticket_grants g where g.user_id = uid and g.reason = 'night'),
    'backlog_done', (select count(*) from public.coin_grants c where c.user_id = uid and c.reason = 'backlog_done'),
    'must_done', (select count(*) from public.coin_grants c
                  where c.user_id = uid and c.reason = 'backlog_done' and c.paid_as = 'must'),
    'first10s', (select count(*) from public.block_logs l
                 where l.user_id = uid and l.first10_at is not null and not l.backfilled),
    'all_first10_days', (select count(*) from (
                           select l.date from public.block_logs l
                           where l.user_id = uid and l.first10_at is not null and not l.backfilled
                           group by l.date having count(distinct l.block) >= 7) x),
    'blocks_closed', (select count(*) from public.block_logs l
                      where l.user_id = uid and l.closed_at is not null and not l.backfilled),
    'best_streak', (select coalesce(best_streak, 0) from public.game_state where user_id = uid),
    'streak', (select coalesce(streak, 0) from public.game_state where user_id = uid)
  )
$$;

-- Pays every unlock reached and not yet paid (once, same ledger as setup rewards).
-- Returns {counts, done, granted}.
create or replace function public.claim_unlocks()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  c jsonb;
  granted text[] := '{}';
  paid text[];
  r record;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  perform 1 from public.game_state where user_id = uid for update;
  c := public._unlock_counts(uid);
  for r in
    select * from (values
      ('first_night', 'nights', 1), ('first_backlog', 'backlog_done', 1),
      ('all_first10_day', 'all_first10_days', 1), ('first10_20', 'first10s', 20),
      ('must_10', 'must_done', 10), ('streak_7', 'best_streak', 7),
      ('streak_30', 'best_streak', 30), ('blocks_100', 'blocks_closed', 100)
    ) as t(id, metric, need)
  loop
    if (c ->> r.metric)::integer >= r.need and public._grant_unlock(uid, r.id) then
      granted := granted || r.id;
    end if;
  end loop;
  select coalesce(array_agg(unlock_id order by unlock_id), '{}') into paid
  from public.unlock_grants where user_id = uid;
  return jsonb_build_object('counts', c, 'done', to_jsonb(paid), 'granted', to_jsonb(granted));
end $$;

revoke all on function public._setup_reward(text) from public, anon, authenticated;
revoke all on function public._grant_unlock(uuid, text) from public, anon, authenticated;
revoke all on function public._unlock_counts(uuid) from public, anon, authenticated;
revoke all on function public.claim_unlocks() from public, anon;
grant execute on function public.claim_unlocks() to authenticated;
