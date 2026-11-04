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
  if current_user = 'service_role' or current_setting('role', true) = 'service_role' then
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
  tz text;
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
  if month is not null then
    select timezone into tz from public.profiles where user_id = uid;
    if extract(month from (now() at time zone coalesce(tz, 'Asia/Bangkok')))::integer <> month then
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
    'must_done', (select count(*) from public.coin_grants c join public.backlog_items i
                    on i.id::text = c.ref and i.user_id = uid
                  where c.user_id = uid and c.reason = 'backlog_done' and i.priority = 'must'),
    'first10s', (select count(*) from public.block_logs l
                 where l.user_id = uid and l.first10_at is not null and not l.backfilled),
    'all_first10_days', (select count(*) from (
                           select l.date from public.block_logs l
                           where l.user_id = uid and l.first10_at is not null and not l.backfilled
                           group by l.date having count(distinct l.block) >= 7) x),
    'blocks_closed', (select count(*) from public.block_logs l
                      where l.user_id = uid and l.closed_at is not null and not l.backfilled),
    'best_streak', (select coalesce(best_streak, 0) from public.game_state where user_id = uid)
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
