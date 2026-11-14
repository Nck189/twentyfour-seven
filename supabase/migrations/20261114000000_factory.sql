-- M13 factory (SPEC §9): machines turn crops and animal goods into products that sell at the
-- market. Every number mirrors content/factory.ts (`factory_catalog()`; the integration test checks
-- they match). The server owns the clock: a job's start and ready times are set here from now(),
-- one machine works one job at a time, inputs are taken (lowest quality first) when a job starts,
-- and products land in the inventory only when collected after they are ready.

create table public.machines (
  user_id uuid not null references auth.users (id) on delete cascade,
  machine_id text not null check (machine_id in ('jam_jar', 'cheese_press', 'loom', 'bakery')),
  speed_level integer not null default 0 check (speed_level between 0 and 2),
  capacity_level integer not null default 0 check (capacity_level between 0 and 2),
  bought_at timestamptz not null default now(),
  primary key (user_id, machine_id)
);
alter table public.machines enable row level security;
alter table public.machines force row level security;
create policy "own rows: select" on public.machines for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.machines from anon, authenticated;
grant select on public.machines to authenticated;

create table public.production_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  machine_id text not null,
  recipe_id text not null,
  created_at timestamptz not null default now(),
  start_at timestamptz not null,
  ready_at timestamptz not null,
  collected_at timestamptz,
  check (ready_at > start_at and start_at >= created_at),
  foreign key (user_id, machine_id) references public.machines (user_id, machine_id) on delete cascade
);
create index production_jobs_machine on public.production_jobs (user_id, machine_id, ready_at);
create index production_jobs_open on public.production_jobs (user_id) where collected_at is null;
alter table public.production_jobs enable row level security;
alter table public.production_jobs force row level security;
create policy "own rows: select" on public.production_jobs for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.production_jobs from anon, authenticated;
grant select on public.production_jobs to authenticated;

-- Server-written events only (adds the factory ones).
drop policy if exists "own rows: insert" on public.events;
create policy "own rows: insert" on public.events for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and type not in ('ticket_granted', 'wake_pressed', 'wake_backfilled', 'night_ritual_completed',
                     'gacha_pull', 'coins_granted', 'essence_granted', 'egg_hatched', 'harvest',
                     'seed_planted', 'decor_bought', 'star_up', 'unlock_granted',
                     'exercise_logged', 'animal_petted', 'produce_collected', 'animal_fed',
                     'days_settled', 'weekly_review_done',
                     'produce_sold', 'seed_bought', 'ticket_exchanged', 'upgrade_bought',
                     'order_delivered', 'reward_redeemed',
                     'seasonal_order_delivered', 'wish_floated', 'story_seen',
                     'cafe_order', 'cafe_card', 'coffee_answered', 'coffee_cup_added',
                     'push_subscribed', 'ics_link_made',
                     'share_link_made', 'share_link_off', 'booking_requested', 'booking_answered',
                     'machine_bought', 'machine_upgraded', 'job_started', 'jobs_collected')
  );

-- The catalog (content/factory.ts). Inputs are inventory keys: `crop:<id>` takes any quality.
create or replace function public._factory_catalog()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select '{
    "speed_factor": [1, 0.8, 0.65],
    "capacity": [2, 3, 4],
    "machines": {
      "jam_jar":      {"price": 150, "speed": [200, 500], "capacity": [150, 400]},
      "cheese_press": {"price": 250, "speed": [250, 600], "capacity": [200, 450]},
      "loom":         {"price": 300, "speed": [250, 600], "capacity": [200, 450]},
      "bakery":       {"price": 400, "speed": [300, 700], "capacity": [250, 500]}
    },
    "recipes": {
      "pickles":         {"machine": "jam_jar", "minutes": 20, "price": 34,
                          "inputs": [{"item": "crop:radish", "qty": 2}, {"item": "crop:turnip", "qty": 2}]},
      "strawberry_jam":  {"machine": "jam_jar", "minutes": 30, "price": 42,
                          "inputs": [{"item": "crop:strawberry", "qty": 3}]},
      "tomato_sauce":    {"machine": "jam_jar", "minutes": 40, "price": 44,
                          "inputs": [{"item": "crop:tomato", "qty": 3}]},
      "butter":          {"machine": "cheese_press", "minutes": 30, "price": 18,
                          "inputs": [{"item": "produce:milk", "qty": 2}]},
      "cheese":          {"machine": "cheese_press", "minutes": 60, "price": 28,
                          "inputs": [{"item": "produce:milk", "qty": 3}]},
      "yarn":            {"machine": "loom", "minutes": 30, "price": 18,
                          "inputs": [{"item": "produce:wool", "qty": 2}]},
      "sweater":         {"machine": "loom", "minutes": 120, "price": 40,
                          "inputs": [{"item": "produce:wool", "qty": 4}]},
      "lavender_sachet": {"machine": "loom", "minutes": 60, "price": 52,
                          "inputs": [{"item": "crop:lavender", "qty": 1}, {"item": "produce:wool", "qty": 1}]},
      "carrot_cake":     {"machine": "bakery", "minutes": 45, "price": 30,
                          "inputs": [{"item": "crop:carrot", "qty": 2}, {"item": "produce:egg", "qty": 2}]},
      "cornbread":       {"machine": "bakery", "minutes": 60, "price": 48,
                          "inputs": [{"item": "crop:corn", "qty": 3}, {"item": "produce:egg", "qty": 1}]},
      "pumpkin_pie":     {"machine": "bakery", "minutes": 90, "price": 46,
                          "inputs": [{"item": "crop:pumpkin", "qty": 1}, {"item": "produce:egg", "qty": 2},
                                     {"item": "produce:milk", "qty": 1}]}
    }
  }'::jsonb
$$;

-- For the parity test and the client's sanity check (content only, nothing per user). Security
-- definer: it reads the private helper clients can't run (G7 R-M13-1).
create or replace function public.factory_catalog()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$ select public._factory_catalog() $$;

-- Stock of one input key: `crop:<id>` counts every quality of that crop; others are exact.
create or replace function public._stock_of(uid uuid, p_key text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(qty), 0)::integer from public.inventory
  where user_id = uid and qty > 0
    -- An exact prefix, not LIKE: item ids contain '_' (a LIKE wildcard).
    and (item_id = p_key or (left(p_key, 5) = 'crop:' and left(item_id, length(p_key) + 1) = p_key || ':'))
$$;

-- ---------- prices: products sell at the market (the latest formula + the product branch) ----------
create or replace function public._sell_price(p_item text, p_stall integer, p_season numeric)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  parts text[] := string_to_array(p_item, ':');
  stall numeric := 1 + 0.1 * p_stall;
  season numeric := coalesce(p_season, 1);
  base integer;
  q numeric;
  m numeric := 1;
begin
  if parts[1] = 'product' and array_length(parts, 1) = 2 then
    base := (public._factory_catalog() -> 'recipes' -> parts[2] ->> 'price')::integer;
    if base is null then
      return null;
    end if;
    return round(base * stall);
  end if;
  if parts[1] = 'produce' and array_length(parts, 1) = 2 then
    base := case parts[2] when 'egg' then 4 when 'golden_egg' then 20 when 'milk' then 6
                          when 'wool' then 6 when 'truffle' then 12 when 'gift' then 15 end;
    return round(base * stall);
  end if;
  if parts[1] <> 'crop' then
    return null;
  end if;
  base := public._sell_base(public._crop_rarity(parts[2]));
  if base is null then
    return null;
  end if;
  if array_length(parts, 1) = 2 then
    return round(base * stall * season);
  end if;
  if array_length(parts, 1) <> 4 or parts[4] !~ '^\d+$' then
    return null;
  end if;
  q := case parts[3] when 'normal' then 1 when 'silver' then 1.25 when 'gold' then 1.5 when 'prismatic' then 2 end;
  if q is null then
    return null;
  end if;
  m := least(parts[4]::numeric / 100, 4);
  return round(base * q * m * stall * season);
end $$;

-- ---------- build, upgrade ----------
create or replace function public.buy_machine(p_machine text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  price integer;
  left_coins integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  price := (public._factory_catalog() -> 'machines' -> p_machine ->> 'price')::integer;
  if price is null then
    raise exception 'no such machine' using errcode = '22023';
  end if;
  perform 1 from public.game_state where user_id = uid for update;
  if exists (select 1 from public.machines where user_id = uid and machine_id = p_machine) then
    raise exception 'already built' using errcode = 'P0001';
  end if;
  update public.game_state set coins = coins - price where user_id = uid and coins >= price
  returning coins into left_coins;
  if not found then
    raise exception 'not enough coins' using errcode = 'P0001';
  end if;
  insert into public.machines (user_id, machine_id) values (uid, p_machine);
  insert into public.events (user_id, type, payload)
  values (uid, 'machine_bought', jsonb_build_object('machine', p_machine, 'coins', price));
  return jsonb_build_object('coins', left_coins);
end $$;

create or replace function public.upgrade_machine(p_machine text, p_track text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  m public.machines;
  lvl integer;
  price integer;
  left_coins integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_track is null or p_track not in ('speed', 'capacity') then
    raise exception 'no such upgrade' using errcode = '22023';
  end if;
  perform 1 from public.game_state where user_id = uid for update;
  select * into m from public.machines where user_id = uid and machine_id = p_machine for update;
  if not found then
    raise exception 'build it first' using errcode = 'P0002';
  end if;
  lvl := case p_track when 'speed' then m.speed_level else m.capacity_level end;
  price := (public._factory_catalog() -> 'machines' -> p_machine -> p_track ->> lvl)::integer;
  if price is null then
    raise exception 'already at the top level' using errcode = 'P0001';
  end if;
  update public.game_state set coins = coins - price where user_id = uid and coins >= price
  returning coins into left_coins;
  if not found then
    raise exception 'not enough coins' using errcode = 'P0001';
  end if;
  if p_track = 'speed' then
    update public.machines set speed_level = speed_level + 1 where user_id = uid and machine_id = p_machine;
  else
    update public.machines set capacity_level = capacity_level + 1 where user_id = uid and machine_id = p_machine;
  end if;
  insert into public.events (user_id, type, payload)
  values (uid, 'machine_upgraded',
          jsonb_build_object('machine', p_machine, 'track', p_track, 'level', lvl + 1, 'coins', price));
  return jsonb_build_object('coins', left_coins, 'level', lvl + 1);
end $$;

-- ---------- the queue ----------
-- Start a job: the machine must have room, every input must be in stock; inputs are taken now
-- (lowest quality first), and the job starts when the machine's last job ends (or now).
create or replace function public.start_job(p_machine text, p_recipe text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  cat jsonb := public._factory_catalog();
  r jsonb := cat -> 'recipes' -> p_recipe;
  m public.machines;
  input jsonb;
  key text;
  need integer;
  take integer;
  inv record;
  start_at timestamptz;
  ready_at timestamptz;
  minutes integer;
  jid uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if r is null or r ->> 'machine' is distinct from p_machine then
    raise exception 'no such recipe on this machine' using errcode = '22023';
  end if;
  -- One stock change at a time per user (sells, orders, jobs all take from the inventory).
  perform 1 from public.game_state where user_id = uid for update;
  select * into m from public.machines where user_id = uid and machine_id = p_machine for update;
  if not found then
    raise exception 'build it first' using errcode = 'P0002';
  end if;
  if (select count(*) from public.production_jobs
      where user_id = uid and machine_id = p_machine and collected_at is null)
     >= (cat -> 'capacity' ->> m.capacity_level)::integer then
    raise exception 'the queue is full' using errcode = 'P0001';
  end if;
  for input in select * from jsonb_array_elements(r -> 'inputs') loop
    if public._stock_of(uid, input ->> 'item') < (input ->> 'qty')::integer then
      raise exception 'not enough %', input ->> 'item' using errcode = 'P0001';
    end if;
  end loop;
  for input in select * from jsonb_array_elements(r -> 'inputs') loop
    key := input ->> 'item';
    need := (input ->> 'qty')::integer;
    for inv in
      select item_id, qty from public.inventory
      where user_id = uid and qty > 0
        and (item_id = key or (left(key, 5) = 'crop:' and left(item_id, length(key) + 1) = key || ':'))
      -- Lowest quality first (then weather, then id), like orders (docs/ECONOMY.md).
      order by array_position(array['normal', 'silver', 'gold', 'prismatic'],
                              coalesce(split_part(item_id, ':', 3), '')) nulls first,
               public._sell_price(item_id, 0), item_id
      for update
    loop
      exit when need = 0;
      take := least(need, inv.qty);
      update public.inventory set qty = qty - take, updated_at = now()
      where user_id = uid and item_id = inv.item_id;
      need := need - take;
    end loop;
    if need > 0 then
      raise exception 'not enough %', key using errcode = 'P0001';
    end if;
  end loop;
  minutes := round((r ->> 'minutes')::numeric * (cat -> 'speed_factor' ->> m.speed_level)::numeric);
  start_at := greatest(now(), coalesce((select max(j.ready_at) from public.production_jobs j
                                        where j.user_id = uid and j.machine_id = p_machine), now()));
  ready_at := start_at + make_interval(mins => minutes);
  insert into public.production_jobs (user_id, machine_id, recipe_id, start_at, ready_at)
  values (uid, p_machine, p_recipe, start_at, ready_at)
  returning id into jid;
  insert into public.events (user_id, type, payload)
  values (uid, 'job_started', jsonb_build_object('machine', p_machine, 'recipe', p_recipe, 'id', jid,
                                                 'minutes', minutes, 'ready_at', ready_at));
  return jsonb_build_object('id', jid, 'start_at', start_at, 'ready_at', ready_at);
end $$;

-- Collect every finished job (on one machine, or all with null): products go to the inventory.
create or replace function public.collect_jobs(p_machine text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  got jsonb;
  n integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  perform 1 from public.game_state where user_id = uid for update;
  with done as (
    update public.production_jobs set collected_at = now()
    where user_id = uid and collected_at is null and ready_at <= now()
      and (p_machine is null or machine_id = p_machine)
    returning recipe_id
  ), per as (
    select recipe_id, count(*)::integer as qty from done group by recipe_id
  ), stocked as (
    insert into public.inventory (user_id, item_id, qty)
    select uid, 'product:' || recipe_id, qty from per
    on conflict (user_id, item_id) do update
      set qty = public.inventory.qty + excluded.qty, updated_at = now()
    returning 1
  )
  select coalesce(jsonb_object_agg(recipe_id, qty), '{}'::jsonb), coalesce(sum(qty), 0)::integer
  into got, n from per;
  if n > 0 then
    insert into public.events (user_id, type, payload)
    values (uid, 'jobs_collected', jsonb_build_object('machine', p_machine, 'products', got, 'n', n));
  end if;
  return jsonb_build_object('collected', got, 'n', n);
end $$;

revoke all on function public._factory_catalog() from public, anon, authenticated;
revoke all on function public._stock_of(uuid, text) from public, anon, authenticated;
revoke all on function public._sell_price(text, integer, numeric) from public, anon, authenticated;
revoke all on function public.factory_catalog() from public, anon;
grant execute on function public.factory_catalog() to authenticated;
revoke all on function public.buy_machine(text) from public, anon;
grant execute on function public.buy_machine(text) to authenticated;
revoke all on function public.upgrade_machine(text, text) from public, anon;
grant execute on function public.upgrade_machine(text, text) to authenticated;
revoke all on function public.start_job(text, text) from public, anon;
grant execute on function public.start_job(text, text) to authenticated;
revoke all on function public.collect_jobs(text) from public, anon;
grant execute on function public.collect_jobs(text) to authenticated;
