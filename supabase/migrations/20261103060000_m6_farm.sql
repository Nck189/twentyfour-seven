-- M6 farm: plant a seed, harvest a ripe crop (SPEC §8.1–8.4).
--
-- The farm state is computed from data by lib/game (growth, weeds, wilt, death, quality,
-- mutations); a plots row only holds the planting. Harvesting is a reward, so the server
-- re-checks ripeness with the same growth rules, mirrored here (tests/integration/farm.test.ts
-- checks the two agree on a seeded week). Numbers mirror content/crops.ts and content/game.ts.

-- A regrowing crop (uncommon) counts again from the day after its last harvest.
alter table public.plots add column harvested_on date;

-- Starter seeds anyone can plant until the gacha (M7) adds an inventory (content/crops.ts).
create or replace function public._starter_crop(p_crop text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_crop = any (array['radish', 'turnip', 'lettuce', 'carrot']);
$$;

-- Success-days to ripe, by rarity (content/crops.ts GROW_DAYS); null = unknown crop.
create or replace function public._crop_grow_days(p_crop text)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select (case
    when p_crop in ('radish', 'turnip', 'lettuce', 'carrot') then 1
    when p_crop in ('strawberry', 'blueberry', 'tomato', 'corn') then 2
    when p_crop in ('pumpkin', 'melon', 'sunflower', 'coffee') then 3
    when p_crop in ('dragon_fruit', 'lavender', 'grape', 'cherry_tree') then 5
    when p_crop in ('star_fruit', 'moon_melon', 'crystal_rose', 'rainbow_corn') then 7
  end)::smallint;
$$;

create or replace function public._crop_regrows(p_crop text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_crop in ('strawberry', 'blueberry', 'tomato', 'corn');
$$;

-- The wake-day "now" belongs to (the app's currentDayDate): before today's wake it's yesterday.
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
    (select target_wake from public.wake_snapshots where user_id = uid and date = d),
    public._target_wake(uid, d));
  if w is not null and now() < w then
    return d - 1;
  end if;
  return d;
end $$;

-- How a block went for the farm (lib/game/outcome.ts blockResult):
-- success | partial | miss | excused | backfilled | open.
create or replace function public._block_result(lg public.block_logs, p_mode text, p_open boolean)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if coalesce(p_mode, 'normal') <> 'normal' then
    return 'excused';
  end if;
  if lg.id is not null then
    if lg.planned_deviation then
      return 'excused';
    end if;
    if lg.miss_reason is not null then
      return 'miss';
    end if;
    if lg.backfilled then
      return 'backfilled';
    end if;
    -- On-time start (±10 min) or checklist ≥ 70%.
    if (lg.planned_start is not null and lg.started_at is not null
        and abs(extract(epoch from lg.started_at - lg.planned_start)) <= 600)
       or (lg.items_planned > 0
           and least(1.0, jsonb_array_length(lg.items_done)::numeric / lg.items_planned) >= 0.7) then
      return 'success';
    end if;
  end if;
  if p_open then
    return 'open';
  end if;
  if lg.id is not null and lg.started_at is not null then
    return 'partial';
  end if;
  return 'miss';
end $$;

-- Is this planting ripe on wake-day p_today? (lib/game/growth.ts simulatePlot, growth part:
-- weeds pause growth until the end of the next minimum day; 5 misses in a row kill.)
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
    -- A planned late night (out late before d + 1) excuses that evening's Free (G7 R-M6-2).
    if r in ('miss', 'partial') and p.slot = 'free'
       and exists (select 1 from public.day_plans
                   where user_id = uid and date = d + 1 and late_night is not null) then
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

-- Plant a seed in a block plot. Replacing a crop (or clearing a dead one) needs p_replace.
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
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_slot not in ('down', 'sleep', 'wake', 'focus', 'work', 'gradation', 'free') then
    raise exception 'unknown plot' using errcode = '22023';
  end if;
  if not public._starter_crop(p_crop) then
    raise exception 'seed not available' using errcode = '42501';
  end if;
  select * into p from public.plots where user_id = uid and slot = p_slot for update;
  if not found then
    raise exception 'no such plot' using errcode = 'P0002';
  end if;
  if p.crop_id is not null and not p_replace then
    raise exception 'plot in use' using errcode = '23505';
  end if;
  replaced := p.crop_id;
  day := public._wake_day(uid);
  update public.plots
  set crop_id = p_crop, star = 1, planted_on = day, harvested_on = null, growth_days = 0,
      quality = 'normal', mutations = '{}', weeds = false, wilt_level = 0, state = 'growing'
  where id = p.id
  returning * into p;
  insert into public.events (user_id, type, payload)
  values (uid, 'seed_planted',
          jsonb_build_object('slot', p_slot, 'crop', p_crop, 'date', day, 'replaced', replaced));
  return p;
end $$;

-- Harvest a ripe crop: the produce goes to the inventory (its value arrives with M7). A
-- regrowing crop stays and counts again from tomorrow; any other crop leaves the plot empty.
create or replace function public.harvest_plot(p_slot text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  p public.plots;
  day date;
  regrow boolean;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into p from public.plots where user_id = uid and slot = p_slot for update;
  if not found or p.crop_id is null then
    raise exception 'nothing to harvest' using errcode = 'P0002';
  end if;
  day := public._wake_day(uid);
  if not public._plot_ripe(uid, p, day) then
    raise exception 'not ripe yet' using errcode = '22023';
  end if;
  regrow := public._crop_regrows(p.crop_id);
  if regrow then
    update public.plots set harvested_on = day, state = 'growing' where id = p.id;
  else
    update public.plots
    set crop_id = null, planted_on = null, harvested_on = null, growth_days = 0, quality = 'normal',
        mutations = '{}', weeds = false, wilt_level = 0, state = 'empty'
    where id = p.id;
  end if;
  insert into public.inventory (user_id, item_id, qty)
  values (uid, 'crop:' || p.crop_id, 1)
  on conflict (user_id, item_id) do update set qty = public.inventory.qty + 1;
  insert into public.events (user_id, type, payload)
  values (uid, 'harvest', jsonb_build_object('slot', p_slot, 'crop', p.crop_id, 'date', day, 'regrow', regrow));
  return jsonb_build_object('crop', p.crop_id, 'regrow', regrow, 'date', day);
end $$;

-- M3-F8 still holds for clients, and a client can't log a future day (G7 R-M6-1); the service
-- role may write a past log as live (test setup only: it already bypasses RLS).
create or replace function public.block_logs_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  grace interval := interval '10 minutes';
  is_backfill boolean := false;
  tz text;
  today date;
begin
  -- Admin (service role) may write logs as they are, e.g. to set up a past week in a test.
  if current_user = 'service_role' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.backfilled then
    new.backfilled := true;
  end if;
  select timezone into tz from public.profiles where user_id = new.user_id;
  today := (now() at time zone coalesce(tz, 'Asia/Bangkok'))::date;
  -- G7 R-M6-1: no check-ins for a day that hasn't come (they'd count as live when it does).
  if new.date > today then
    raise exception 'a check-in can''t be for a future day' using errcode = '22023';
  end if;
  if new.date < today - 1 then
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

-- Decor shop basics (SPEC §8.9): coins buy fences, paths, flowers, a pond (content/decor.ts).
create or replace function public._decor_price(p_item text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_item when 'fence' then 40 when 'path' then 30 when 'flowers' then 50 when 'pond' then 300 end;
$$;

-- Buy one decor item: the coins come off atomically (never below zero), the item lands on the farm.
create or replace function public.buy_decor(p_item text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  price integer := public._decor_price(p_item);
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

-- Planting and buying decor are server-only events too (the audit log can't be faked).
drop policy if exists "own rows: insert" on public.events;
create policy "own rows: insert" on public.events for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and type not in ('ticket_granted', 'wake_pressed', 'wake_backfilled', 'night_ritual_completed',
                     'gacha_pull', 'coins_granted', 'essence_granted', 'egg_hatched', 'harvest',
                     'seed_planted', 'decor_bought')
  );

-- The farm follows other devices live (planting/harvest on the phone shows on the Mac).
alter publication supabase_realtime add table public.plots;

revoke all on function public._starter_crop(text) from public, anon, authenticated;
revoke all on function public._crop_grow_days(text) from public, anon, authenticated;
revoke all on function public._crop_regrows(text) from public, anon, authenticated;
revoke all on function public._wake_day(uuid) from public, anon, authenticated;
revoke all on function public._block_result(public.block_logs, text, boolean) from public, anon, authenticated;
revoke all on function public._plot_ripe(uuid, public.plots, date) from public, anon, authenticated;
revoke all on function public.plant_seed(text, text, boolean) from public, anon;
grant execute on function public.plant_seed(text, text, boolean) to authenticated;
revoke all on function public._decor_price(text) from public, anon, authenticated;
revoke all on function public.buy_decor(text) from public, anon;
grant execute on function public.buy_decor(text) to authenticated;
revoke all on function public.harvest_plot(text) from public, anon;
grant execute on function public.harvest_plot(text) to authenticated;
