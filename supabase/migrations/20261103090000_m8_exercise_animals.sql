-- M8: exercise (SPEC §6) + animals (SPEC §8.6). Workouts are logged through `log_exercise` only
-- (feed and eggs are paid here, server-side); hatches roll here; produce, petting and feed items are
-- RPCs too. Numbers mirror content/animals.ts (a unit test checks).

-- ---------- exercise logs: server-written ----------
alter table public.exercise_logs add column counted boolean not null default false;
alter table public.exercise_logs add column idempotency_key text;
create unique index exercise_logs_idem on public.exercise_logs (user_id, idempotency_key)
  where idempotency_key is not null;
drop policy if exists "own rows: insert" on public.exercise_logs;
drop policy if exists "own rows: update" on public.exercise_logs;
drop policy if exists "own rows: delete" on public.exercise_logs;
revoke insert, update, delete, truncate on public.exercise_logs from authenticated;

alter table public.game_state add column egg_progress smallint not null default 0
  check (egg_progress between 0 and 2);

create index if not exists animals_user on public.animals (user_id);

-- ---------- profiles.timezone: only real zone names (R-M8-1) ----------
-- POSIX offsets like 'XXX-04:12:07' or '<+99>-99' moved "local midnight" anywhere. Real zones can
-- still be switched, so reward caps don't use a local day at all (rolling 24 h below).
create or replace function public.profiles_timezone_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.timezone is distinct from old.timezone
     and not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'unknown timezone' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger profiles_timezone_guard before update of timezone on public.profiles
  for each row execute function public.profiles_timezone_guard();

-- ---------- static content mirrors ----------
-- Hatch roll (content/animals.ts HATCH_RATES; species evenly within a rarity, catalog order).
create or replace function public._hatch_roll(r float8, c float8)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  rarity text;
  pool text[];
begin
  rarity := case
    when r < 0.02 then 'legendary'
    when r < 0.02 + 0.05 then 'epic'
    when r < 0.02 + 0.05 + 0.13 then 'rare'
    when r < 0.02 + 0.05 + 0.13 + 0.3 then 'uncommon'
    else 'common' end;
  pool := case rarity
    when 'common' then array['chicken', 'duck', 'bunny']
    when 'uncommon' then array['cow', 'sheep', 'pig']
    when 'rare' then array['cat', 'dog', 'goat']
    when 'epic' then array['capybara', 'alpaca']
    else array['red_panda', 'golden_goose'] end;
  return jsonb_build_object('rarity', rarity,
    'species', pool[least(array_length(pool, 1), floor(c * array_length(pool, 1))::integer + 1)]);
end $$;

create or replace function public._animal_produce(p_species text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_species
    when 'chicken' then 'egg' when 'duck' then 'egg' when 'bunny' then 'wool'
    when 'cow' then 'milk' when 'sheep' then 'wool' when 'pig' then 'truffle'
    when 'cat' then 'gift' when 'dog' then 'gift' when 'goat' then 'milk'
    when 'capybara' then 'gift' when 'alpaca' then 'wool'
    when 'red_panda' then 'gift' when 'golden_goose' then 'golden_egg'
  end
$$;

-- Feed on top of what's left (never from the past), at most 14 days ahead.
create or replace function public._add_feed(p_fed timestamptz, p_days integer)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select least(greatest(now(), coalesce(p_fed, now())) + make_interval(days => p_days),
               now() + interval '14 days')
$$;

-- ---------- log a workout ----------
-- Counts for feed + eggs when ≥ 10 min and fewer than 2 counted workouts in the last 24 h.
-- A counted workout feeds every animal 2 days; every 3rd fills the egg, which hatches here.
create or replace function public.log_exercise(p_type text, p_minutes integer, p_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  gs public.game_state;
  log public.exercise_logs;
  is_counted boolean;
  hatched jsonb := null;
  roll jsonb;
  pet public.animals;
  prev jsonb;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_type is null or p_type not in ('gym', 'run', 'walk', 'other') then
    raise exception 'unknown exercise type' using errcode = '22023';
  end if;
  if p_minutes is null or p_minutes < 1 or p_minutes > 600 then
    raise exception 'minutes must be 1–600' using errcode = '22023';
  end if;
  if p_key is null or length(p_key) < 8 or length(p_key) > 80 then
    raise exception 'idempotency key required' using errcode = '22023';
  end if;
  select * into gs from public.game_state where user_id = uid for update;
  if not found then
    raise exception 'no game state' using errcode = 'P0002';
  end if;

  -- Retried request: hand back what that key already did.
  select * into log from public.exercise_logs where user_id = uid and idempotency_key = p_key;
  if found then
    select e.payload into prev from public.events e
      where e.user_id = uid and e.type = 'exercise_logged' and e.payload ->> 'key' = p_key
      order by e.at desc limit 1;
    return jsonb_build_object('repeat', true, 'id', log.id, 'counted', log.counted,
      'egg_progress', gs.egg_progress, 'hatched', prev -> 'hatched');
  end if;

  -- A rolling 24 h window: no midnight to move, so a timezone change can't reset it (R-M8-1).
  is_counted := p_minutes >= 10 and (
    select count(*) from public.exercise_logs l
    where l.user_id = uid and l.counted and l.at > now() - interval '24 hours'
  ) < 2;

  insert into public.exercise_logs (user_id, at, type, minutes, counted, idempotency_key)
  values (uid, now(), p_type, p_minutes, is_counted, p_key)
  returning * into log;

  if is_counted then
    update public.animals set fed_until = public._add_feed(fed_until, 2) where user_id = uid;
    if gs.egg_progress + 1 >= 3 then
      roll := public._hatch_roll(random(), random());
      insert into public.animals (user_id, species, fed_until)
      values (uid, roll ->> 'species', public._add_feed(null, 2))
      returning * into pet;
      hatched := jsonb_build_object('id', pet.id, 'species', pet.species, 'rarity', roll ->> 'rarity');
      update public.game_state set egg_progress = 0 where user_id = uid returning * into gs;
      insert into public.events (user_id, type, payload)
      values (uid, 'egg_hatched', hatched);
    else
      update public.game_state set egg_progress = egg_progress + 1 where user_id = uid returning * into gs;
    end if;
  end if;

  insert into public.events (user_id, type, payload)
  values (uid, 'exercise_logged', jsonb_build_object('type', p_type, 'minutes', p_minutes,
    'counted', is_counted, 'key', p_key, 'hatched', hatched));
  return jsonb_build_object('repeat', false, 'id', log.id, 'counted', is_counted,
    'egg_progress', gs.egg_progress, 'hatched', hatched);
end $$;

-- ---------- pet an animal: +1 love, at most 3 counted pets per animal in the last 24 h ----------
create or replace function public.pet_animal(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  pet public.animals;
  today integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into pet from public.animals where id = p_id and user_id = uid for update;
  if not found then
    raise exception 'not your animal' using errcode = 'P0002';
  end if;
  select count(*) into today from public.events e
  where e.user_id = uid and e.type = 'animal_petted' and e.payload ->> 'animal' = p_id::text
    and e.at > now() - interval '24 hours';
  if today >= 3 then
    return jsonb_build_object('love', pet.love, 'counted', false);
  end if;
  update public.animals set love = least(100, love + 1) where id = p_id returning * into pet;
  insert into public.events (user_id, type, payload)
  values (uid, 'animal_petted', jsonb_build_object('animal', p_id, 'love', pet.love));
  return jsonb_build_object('love', pet.love, 'counted', true);
end $$;

-- ---------- collect produce: a fed animal makes one a day; +1 love ----------
create or replace function public.collect_produce(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  pet public.animals;
  item text;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into pet from public.animals where id = p_id and user_id = uid for update;
  if not found then
    raise exception 'not your animal' using errcode = 'P0002';
  end if;
  if pet.fed_until is null or pet.fed_until <= now()
     or now() - coalesce(pet.last_produced, pet.created_at) < interval '24 hours' then
    raise exception 'nothing to collect yet' using errcode = 'P0001';
  end if;
  item := public._animal_produce(pet.species);
  insert into public.inventory (user_id, item_id, qty) values (uid, 'produce:' || item, 1)
  on conflict (user_id, item_id) do update set qty = public.inventory.qty + 1;
  update public.animals set last_produced = now(), love = least(100, love + 1)
  where id = p_id returning * into pet;
  insert into public.events (user_id, type, payload)
  values (uid, 'produce_collected', jsonb_build_object('animal', p_id, 'produce', item));
  return jsonb_build_object('produce', item, 'love', pet.love);
end $$;

-- ---------- use a feed item (setup reward): +1 day for one animal ----------
create or replace function public.use_feed(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  pet public.animals;
  left_qty integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into pet from public.animals where id = p_id and user_id = uid for update;
  if not found then
    raise exception 'not your animal' using errcode = 'P0002';
  end if;
  update public.inventory set qty = qty - 1
  where user_id = uid and item_id = 'feed' and qty >= 1
  returning qty into left_qty;
  if not found then
    raise exception 'no feed' using errcode = 'P0001';
  end if;
  update public.animals set fed_until = public._add_feed(fed_until, 1) where id = p_id returning * into pet;
  insert into public.events (user_id, type, payload)
  values (uid, 'animal_fed', jsonb_build_object('animal', p_id));
  return jsonb_build_object('fed_until', pet.fed_until, 'feed_left', left_qty);
end $$;

-- ---------- setup row: weekly exercise goal + gym close time → animal feed (SPEC §8.8c) ----------
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
  if reward ? 'decor' then
    select count(*) into n from public.decor where user_id = uid and item_id = reward ->> 'decor';
    insert into public.decor (user_id, item_id, x, y) values (uid, reward ->> 'decor', n, 0);
  end if;
  insert into public.events (user_id, type, payload)
  values (uid, 'unlock_granted', jsonb_build_object('unlock', p_id, 'reward', reward));
  return true;
end $$;

create or replace function public._setup_done(uid uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_remove(array[
    case when exists (
      select 1 from public.profiles p where p.user_id = uid and (p.onboarding ->> 'done') = 'true'
    ) or exists (
      select 1 from public.templates t where t.user_id = uid and t.updated_at > t.created_at + interval '1 second'
    ) then 'sleep_times' end,
    case when exists (
      select 1 from public.settings s, jsonb_array_elements(case when jsonb_typeof(s.blocks) = 'array' then s.blocks else '[]'::jsonb end) b
      where s.user_id = uid and jsonb_typeof(b -> 'first10') = 'string' and length(b ->> 'first10') > 0
    ) then 'first10' end,
    case when exists (
      select 1 from public.settings s, jsonb_array_elements(case when jsonb_typeof(s.blocks) = 'array' then s.blocks else '[]'::jsonb end) b
      where s.user_id = uid and jsonb_typeof(b -> 'checklist') = 'array' and jsonb_array_length(b -> 'checklist') > 0
    ) or exists (
      select 1 from public.templates t, jsonb_each(case when jsonb_typeof(t.blocks) = 'object' then t.blocks else '{}'::jsonb end) o
      where t.user_id = uid and jsonb_typeof(o.value) = 'object'
        and jsonb_typeof(o.value -> 'checklist') = 'array' and jsonb_array_length(o.value -> 'checklist') > 0
    ) or exists (
      select 1 from public.day_plans d, jsonb_each(case when jsonb_typeof(d.overrides -> 'blocks') = 'object'
                                                        then d.overrides -> 'blocks' else '{}'::jsonb end) o
      where d.user_id = uid and jsonb_typeof(o.value) = 'object'
        and jsonb_typeof(o.value -> 'checklist') = 'array' and jsonb_array_length(o.value -> 'checklist') > 0
    ) then 'checklist' end,
    case when exists (
      select 1 from public.backlog_items i where i.user_id = uid and coalesce(i.estimate_min, 0) > 0
    ) then 'backlog_estimate' end,
    case when exists (
      select 1 from public.events e where e.user_id = uid and e.type = 'locale_changed'
    ) then 'language' end,
    case when exists (
      select 1 from public.events e where e.user_id = uid and e.type = 'exercise_settings_saved'
    ) or exists (
      select 1 from public.settings s
      where s.user_id = uid and (s.weekly_exercise_goal <> 3 or s.gym_close_time <> time '22:00')
    ) then 'exercise' end
  ], null)
$$;

-- ---------- backlog coins: the 150 cap over a rolling 24 h (G7 R-M8-R1) ----------
-- The local-day cap reset whenever the user switched to a zone whose midnight had just passed.
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
  if now() - item.created_at < interval '10 minutes'
     or now() - item.priority_set_at < interval '10 minutes' then
    amount := least(amount, 10);
  end if;

  -- Rolling 24 h (no local midnight to move by switching zones).
  select coalesce(sum(g.amount), 0) into earned_today
    from public.coin_grants g
   where g.user_id = uid and g.reason = 'backlog_done' and g.at > now() - interval '24 hours';
  amount := least(amount, greatest(0, 150 - earned_today));
  if amount <= 0 then
    return jsonb_build_object('coins_granted', 0, 'capped', true);
  end if;

  insert into public.coin_grants (user_id, reason, ref, amount)
  values (uid, 'backlog_done', p_id::text, amount)
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

-- Workouts, hatches, petting, produce and feeding are server-only events.
drop policy if exists "own rows: insert" on public.events;
create policy "own rows: insert" on public.events for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and type not in ('ticket_granted', 'wake_pressed', 'wake_backfilled', 'night_ritual_completed',
                     'gacha_pull', 'coins_granted', 'essence_granted', 'egg_hatched', 'harvest',
                     'seed_planted', 'decor_bought', 'star_up', 'unlock_granted',
                     'exercise_logged', 'animal_petted', 'produce_collected', 'animal_fed')
  );

revoke all on function public._hatch_roll(float8, float8) from public, anon, authenticated;
revoke all on function public._animal_produce(text) from public, anon, authenticated;
revoke all on function public._add_feed(timestamptz, integer) from public, anon, authenticated;
revoke all on function public._setup_reward(text) from public, anon, authenticated;
revoke all on function public._grant_unlock(uuid, text) from public, anon, authenticated;
revoke all on function public._setup_done(uuid) from public, anon, authenticated;
revoke all on function public.log_exercise(text, integer, text) from public, anon;
grant execute on function public.log_exercise(text, integer, text) to authenticated;
revoke all on function public.pet_animal(uuid) from public, anon;
grant execute on function public.pet_animal(uuid) to authenticated;
revoke all on function public.collect_produce(uuid) from public, anon;
grant execute on function public.collect_produce(uuid) to authenticated;
revoke all on function public.use_feed(uuid) from public, anon;
grant execute on function public.use_feed(uuid) to authenticated;
grant execute on function public._hatch_roll(float8, float8) to service_role;

-- Animals follow other devices live (a hatch on the phone shows on the Mac).
alter publication supabase_realtime add table public.animals;
