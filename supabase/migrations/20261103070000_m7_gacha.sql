-- M7 seed capsule machine (SPEC §8.5): server-side rolls, pity, duplicates → shards → star-up,
-- seeds you own become plantable. Numbers mirror content/gacha.ts and content/crops.ts
-- (tests/unit/gacha-sql.test.ts checks the text; tests/integration/gacha.test.ts checks the
-- SQL roll = lib/game/gacha `roll` and simulates 100k pulls in SQL).

-- One pull, deterministic given r (rarity) and c (crop) in [0, 1). Mirror of lib/game/gacha roll.
create or replace function public._gacha_roll(p jsonb, r double precision, c double precision)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  sr integer := coalesce((p ->> 'since_rare')::integer, 0);
  se integer := coalesce((p ->> 'since_epic')::integer, 0);
  sl integer := coalesce((p ->> 'since_legendary')::integer, 0);
  n integer := sl + 1;
  leg double precision;
  rarity text;
  rank integer;
  pool text[];
  crop text;
begin
  if n >= 80 then
    leg := 1;
  elsif n < 61 then
    leg := 0.005;
  else
    leg := least(1, 0.005 + 0.06 * (n - 61 + 1));
  end if;
  if r < leg then rarity := 'legendary';
  elsif r < leg + 0.025 then rarity := 'epic';
  elsif r < leg + 0.025 + 0.09 then rarity := 'rare';
  elsif r < leg + 0.025 + 0.09 + 0.28 then rarity := 'uncommon';
  else rarity := 'common';
  end if;
  rank := array_position(array['common', 'uncommon', 'rare', 'epic', 'legendary'], rarity) - 1;
  if rank < 3 and se + 1 >= 30 then rarity := 'epic'; rank := 3; end if;
  if rank < 2 and sr + 1 >= 10 then rarity := 'rare'; rank := 2; end if;
  pool := case rarity
    when 'common' then array['radish', 'turnip', 'lettuce', 'carrot']
    when 'uncommon' then array['strawberry', 'blueberry', 'tomato', 'corn']
    when 'rare' then array['pumpkin', 'melon', 'sunflower', 'coffee']
    when 'epic' then array['dragon_fruit', 'lavender', 'grape', 'cherry_tree']
    else array['star_fruit', 'moon_melon', 'crystal_rose', 'rainbow_corn']
  end;
  crop := pool[least(4, floor(c * 4)::integer + 1)];
  return jsonb_build_object(
    'rarity', rarity,
    'crop', crop,
    'pity', jsonb_build_object(
      'since_rare', case when rank >= 2 then 0 else sr + 1 end,
      'since_epic', case when rank >= 3 then 0 else se + 1 end,
      'since_legendary', case when rank >= 4 then 0 else sl + 1 end));
end $$;

-- Shards a duplicate gives (content/gacha.ts DUPE_SHARDS).
create or replace function public._dupe_shards(p_rarity text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_rarity when 'common' then 1 when 'uncommon' then 2 when 'rare' then 3
                       when 'epic' then 5 when 'legendary' then 10 end;
$$;

-- Pull 1 or 10 capsules for 1 ticket each. Atomic (game_state row lock), idempotent per key:
-- the same key returns the same results and never charges twice (a retried tap after a
-- dropped connection). Each pull gives one plantable seed; a crop already in the Seed-dex also
-- gives shards for star-up.
create or replace function public.pull_gacha(p_n integer, p_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  gs public.game_state;
  v_pity jsonb;
  out jsonb;
  results jsonb := '[]'::jsonb;
  i integer;
  is_new boolean;
  shards integer;
  v_essence jsonb;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_n not in (1, 10) then
    raise exception 'pull 1 or 10' using errcode = '22023';
  end if;
  if p_key is null or length(p_key) < 8 or length(p_key) > 80 then
    raise exception 'idempotency key required' using errcode = '22023';
  end if;
  select * into gs from public.game_state where user_id = uid for update;
  if not found then
    raise exception 'no game state' using errcode = 'P0002';
  end if;
  -- Retried request: return what that key already pulled.
  -- Each pull row is keyed '<key>:<i>' (the index is unique per user and key).
  -- The server-only gacha_pull event keeps the exact cards (NEW / shards) to hand back.
  if exists (select 1 from public.gacha_pulls where user_id = uid and idempotency_key = p_key || ':1') then
    select e.payload -> 'results' into results
      from public.events e
      where e.user_id = uid and e.type = 'gacha_pull' and e.payload ->> 'key' = p_key
      order by e.at desc limit 1;
    return jsonb_build_object('results', coalesce(results, '[]'::jsonb), 'tickets', gs.tickets,
                              'pity', gs.pity, 'repeat', true);
  end if;
  if gs.tickets < p_n then
    raise exception 'not enough tickets' using errcode = 'P0001';
  end if;
  v_pity := gs.pity;
  v_essence := gs.essence;
  for i in 1..p_n loop
    out := public._gacha_roll(v_pity, random(), random());
    insert into public.gacha_pulls (user_id, at, banner, result, rarity, pity_before, idempotency_key)
    values (uid, clock_timestamp(), 'standard', out ->> 'crop', out ->> 'rarity', v_pity, p_key || ':' || i);
    is_new := not exists (select 1 from public.seed_dex where user_id = uid and crop_id = out ->> 'crop');
    if is_new then
      insert into public.seed_dex (user_id, crop_id) values (uid, out ->> 'crop');
      shards := 0;
    else
      update public.seed_dex set count = count + 1 where user_id = uid and crop_id = out ->> 'crop';
      shards := public._dupe_shards(out ->> 'rarity');
      v_essence := jsonb_set(v_essence, array[out ->> 'crop'],
        to_jsonb(coalesce((v_essence ->> (out ->> 'crop'))::integer, 0) + shards));
    end if;
    insert into public.inventory (user_id, item_id, qty) values (uid, 'seed:' || (out ->> 'crop'), 1)
    on conflict (user_id, item_id) do update set qty = public.inventory.qty + 1;
    results := results || jsonb_build_object('crop', out ->> 'crop', 'rarity', out ->> 'rarity',
                                             'new', is_new, 'shards', shards);
    v_pity := out -> 'pity';
  end loop;
  update public.game_state set tickets = tickets - p_n, pity = v_pity, essence = v_essence
  where user_id = uid
  returning * into gs;
  insert into public.events (user_id, type, payload)
  values (uid, 'gacha_pull', jsonb_build_object('n', p_n, 'key', p_key, 'results', results));
  return jsonb_build_object('results', results, 'tickets', gs.tickets, 'pity', gs.pity, 'repeat', false);
end $$;

-- ★n → ★n+1 for a crop you own, paid in that crop's shards (content/gacha.ts STAR_UP_COST).
create or replace function public.star_up(p_crop text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  dex public.seed_dex;
  gs public.game_state;
  cost integer;
  have integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into gs from public.game_state where user_id = uid for update;
  select * into dex from public.seed_dex where user_id = uid and crop_id = p_crop for update;
  if not found then
    raise exception 'crop not in your Seed-dex' using errcode = 'P0002';
  end if;
  if dex.star >= 5 then
    raise exception 'already ★5' using errcode = '22023';
  end if;
  cost := case dex.star when 1 then 5 when 2 then 10 when 3 then 20 when 4 then 40 end;
  have := coalesce((gs.essence ->> p_crop)::integer, 0);
  if have < cost then
    raise exception 'not enough shards' using errcode = 'P0001';
  end if;
  update public.game_state set essence = jsonb_set(essence, array[p_crop], to_jsonb(have - cost))
  where user_id = uid;
  update public.seed_dex set star = star + 1 where user_id = uid and crop_id = p_crop returning * into dex;
  insert into public.events (user_id, type, payload)
  values (uid, 'star_up', jsonb_build_object('crop', p_crop, 'star', dex.star, 'shards', cost));
  return jsonb_build_object('crop', p_crop, 'star', dex.star, 'shards_left', have - cost);
end $$;

-- Planting: starter seeds are free; any other crop uses one seed from the inventory, and a
-- planted crop carries its Seed-dex star.
create or replace function public.plant_seed(p_slot text, p_crop text, p_replace boolean default false)
returns public.plots
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  p public.plots;
  day date;
  replaced text;
  crop_star smallint;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_slot not in ('down', 'sleep', 'wake', 'focus', 'work', 'gradation', 'free') then
    raise exception 'unknown plot' using errcode = '22023';
  end if;
  if public._crop_grow_days(p_crop) is null then
    raise exception 'unknown seed' using errcode = '22023';
  end if;
  select * into p from public.plots where user_id = uid and slot = p_slot for update;
  if not found then
    raise exception 'no such plot' using errcode = 'P0002';
  end if;
  if p.crop_id is not null and not p_replace then
    raise exception 'plot in use' using errcode = '23505';
  end if;
  if not public._starter_crop(p_crop) then
    update public.inventory set qty = qty - 1
    where user_id = uid and item_id = 'seed:' || p_crop and qty > 0;
    if not found then
      raise exception 'seed not available' using errcode = '42501';
    end if;
  end if;
  select star into crop_star from public.seed_dex where user_id = uid and crop_id = p_crop;
  replaced := p.crop_id;
  day := public._wake_day(uid);
  update public.plots
  set crop_id = p_crop, star = coalesce(crop_star, 1), planted_on = day, harvested_on = null,
      growth_days = 0, quality = 'normal', mutations = '{}', weeds = false, wilt_level = 0,
      state = 'growing'
  where id = p.id
  returning * into p;
  insert into public.events (user_id, type, payload)
  values (uid, 'seed_planted',
          jsonb_build_object('slot', p_slot, 'crop', p_crop, 'date', day, 'replaced', replaced));
  return p;
end $$;

-- Pull and star-up events are server-only too.
drop policy if exists "own rows: insert" on public.events;
create policy "own rows: insert" on public.events for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and type not in ('ticket_granted', 'wake_pressed', 'wake_backfilled', 'night_ritual_completed',
                     'gacha_pull', 'coins_granted', 'essence_granted', 'egg_hatched', 'harvest',
                     'seed_planted', 'decor_bought', 'star_up')
  );

-- A 100k-pull simulation in SQL for the test suite (service role only).
create or replace function public._gacha_simulate(p_n integer)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  pity jsonb := '{"since_rare":0,"since_epic":0,"since_legendary":0}';
  out jsonb;
  counts jsonb := '{"common":0,"uncommon":0,"rare":0,"epic":0,"legendary":0}';
  max_r integer := 0; max_e integer := 0; max_l integer := 0;
  i integer;
begin
  for i in 1..p_n loop
    out := public._gacha_roll(pity, random(), random());
    counts := jsonb_set(counts, array[out ->> 'rarity'], to_jsonb((counts ->> (out ->> 'rarity'))::integer + 1));
    pity := out -> 'pity';
    max_r := greatest(max_r, (pity ->> 'since_rare')::integer);
    max_e := greatest(max_e, (pity ->> 'since_epic')::integer);
    max_l := greatest(max_l, (pity ->> 'since_legendary')::integer);
  end loop;
  return jsonb_build_object('counts', counts, 'max_since_rare', max_r, 'max_since_epic', max_e,
                            'max_since_legendary', max_l);
end $$;

revoke all on function public._gacha_roll(jsonb, double precision, double precision) from public, anon, authenticated;
revoke all on function public._dupe_shards(text) from public, anon, authenticated;
revoke all on function public._gacha_simulate(integer) from public, anon, authenticated;
grant execute on function public._gacha_roll(jsonb, double precision, double precision) to service_role;
grant execute on function public._gacha_simulate(integer) to service_role;
revoke all on function public.pull_gacha(integer, text) from public, anon;
grant execute on function public.pull_gacha(integer, text) to authenticated;
revoke all on function public.star_up(text) from public, anon;
grant execute on function public.star_up(text) to authenticated;
revoke all on function public.plant_seed(text, text, boolean) from public, anon;
grant execute on function public.plant_seed(text, text, boolean) to authenticated;
