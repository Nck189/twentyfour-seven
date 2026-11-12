-- Seasonal crops (docs/STORY.md "Seasonal crops and their story beats", Minnie OK 2026-11-12).
-- One crop a month: days 1–14 its seed is in the seed shop (planting season); day 15 to the
-- month's end it sells at ×1.5 and has one special order (the seasonal market). The story beats
-- and the Candle Lotus wish are in 20261113110000_seasonal_story.sql.
--
-- Mirrors content/seasonal.ts and content/crops.ts (tests/integration/seasonal.test.ts checks
-- prices, offers and orders against lib/game; tests/unit/seasonal.test.ts checks the calendar
-- text). Every coin, ticket and stock change locks the user's game_state row first.

-- ---------- tables ----------

-- Test clock (service role only): the seasonal calendar's date for one user, so tests can stand
-- on day 3 or day 20 of a month. The app never writes it; without a row the calendar follows the
-- user's wake-day.
create table if not exists public.season_clock (
  user_id uuid primary key references auth.users (id) on delete cascade,
  today date not null
);
alter table public.season_clock enable row level security;
alter table public.season_clock force row level security;
create policy "own rows: select" on public.season_clock for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.season_clock from anon, authenticated;
grant select on public.season_clock to authenticated;

-- The seasonal market's special order: once per crop per season-year.
create table if not exists public.seasonal_orders (
  user_id uuid not null references auth.users (id) on delete cascade,
  crop_id text not null,
  year smallint not null,
  qty smallint not null check (qty between 1 and 9),
  coins integer not null check (coins > 0),
  at timestamptz not null default now(),
  primary key (user_id, crop_id, year)
);
alter table public.seasonal_orders enable row level security;
alter table public.seasonal_orders force row level security;
create policy "own rows: select" on public.seasonal_orders for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.seasonal_orders from anon, authenticated;
grant select on public.seasonal_orders to authenticated;

-- Server-written events only (adds the seasonal ones and story_seen, G7 STORY-R5).
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
                     'seasonal_order_delivered', 'wish_floated', 'story_seen')
  );

-- ---------- the crop catalog gains the seasonal crops (content/crops.ts) ----------
-- Seasonal crops are rare (3 success-days) and regrow, so one seed lasts the season.
create or replace function public._crop_grow_days(p_crop text)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select (case
    when p_crop in ('radish', 'turnip', 'lettuce', 'carrot') then 1
    when p_crop in ('strawberry', 'blueberry', 'tomato', 'corn') then 2
    when p_crop in ('pumpkin', 'melon', 'sunflower', 'coffee', 'candle_lotus', 'snow_strawberry') then 3
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
  select p_crop in ('strawberry', 'blueberry', 'tomato', 'corn', 'candle_lotus', 'snow_strawberry');
$$;

-- ---------- the calendar (content/seasonal.ts) ----------
create or replace function public._season_crop(p_month integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_month when 11 then 'candle_lotus' when 12 then 'snow_strawberry' end
$$;

-- The month of a seasonal crop; null = not seasonal.
create or replace function public._season_month(p_crop text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select m from generate_series(1, 12) m where public._season_crop(m) = p_crop limit 1
$$;

-- The seed on sale in planting season (days 1–14), else null.
create or replace function public._season_seed_on(p_day date)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when extract(day from p_day) <= 14
              then public._season_crop(extract(month from p_day)::integer) end
$$;

-- The crop whose seasonal market is open (day 15 to the month's end), else null.
create or replace function public._season_market_on(p_day date)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when extract(day from p_day) > 14
              then public._season_crop(extract(month from p_day)::integer) end
$$;

-- ×1.5 for the market crop's produce during its market, else ×1 (lib/game/seasonal seasonPriceMult).
create or replace function public._season_mult(p_item text, p_day date)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case when split_part(p_item, ':', 1) = 'crop'
                   and split_part(p_item, ':', 2) = public._season_market_on(p_day)
              then 1.5 else 1 end::numeric
$$;

-- The season-year of a date for a seasonal crop: its month and later = this year, else last year.
create or replace function public._season_year(p_crop text, p_day date)
returns integer
language sql
immutable
set search_path = ''
as $$
  select extract(year from p_day)::integer
         - case when extract(month from p_day)::integer < coalesce(public._season_month(p_crop), 1) then 1 else 0 end
$$;

-- The special order's coins: round(1.5 × 1.5 × base × qty) + 10.
create or replace function public._season_order_coins(p_crop text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select (round(1.5 * 1.5 * public._sell_base(public._crop_rarity(p_crop)) * 3) + 10)::integer
$$;

-- The calendar's date for a user: their wake-day (timezone, default Asia/Bangkok) unless a test
-- set the clock.
create or replace function public._season_day(uid uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select c.today from public.season_clock c where c.user_id = uid), public._wake_day(uid))
$$;

-- ---------- prices: one formula with the season multiplier ----------
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

create or replace function public._sell_price(p_item text, p_stall integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select public._sell_price(p_item, p_stall, 1)
$$;

-- Daily orders never ask for a seasonal crop (it has its own special order). Note: until Minnie
-- decides G7 STORY-R7, a stored seasonal seed can still be planted any month and the plant regrows.
create or replace function public._orders(uid uuid, d date)
returns table (slot integer, crop_id text, qty integer, coins integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  pool text[];
  n integer := 1 + public._upgrade_level(uid, 'barn');
  i integer;
  c text;
  h text;
begin
  select array_agg(distinct x) into pool from (
    select unnest(array['radish', 'turnip', 'lettuce', 'carrot']) x
    union
    select e.payload ->> 'crop' from public.events e
    where e.user_id = uid and e.type = 'harvest' and e.payload ? 'crop') s
  where public._crop_rarity(x) is not null and public._season_month(x) is null;
  for i in 0 .. n - 1 loop
    select x into c from unnest(pool) x order by md5(uid::text || d::text || i::text || x) limit 1;
    h := md5(uid::text || d::text || i::text || 'qty');
    slot := i;
    crop_id := c;
    qty := 1 + (('x' || substr(h, 1, 4))::bit(16)::integer % 3);
    coins := round(1.5 * public._sell_base(public._crop_rarity(c)) * qty) + 10;
    return next;
  end loop;
end $$;

-- ---------- status ----------
-- The market shelf prices count the seasonal multiplier (everything else is unchanged).
create or replace function public.market_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date;
  sd date;
  stall integer;
  wk date;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  today := public._wake_day(uid);
  sd := public._season_day(uid);
  wk := today - ((extract(isodow from today)::integer) - 1);
  stall := public._upgrade_level(uid, 'stall');
  return jsonb_build_object(
    'today', today,
    'coins', coalesce((select coins from public.game_state where user_id = uid), 0),
    'levels', jsonb_build_object(
      'stall', stall,
      'barn', public._upgrade_level(uid, 'barn'),
      'house', public._upgrade_level(uid, 'house')),
    'shelf', coalesce((select jsonb_agg(jsonb_build_object(
                                 'item', i.item_id, 'qty', i.qty,
                                 'price', public._sell_price(i.item_id, stall, public._season_mult(i.item_id, sd)),
                                 'season', public._season_mult(i.item_id, sd))
                                        order by i.item_id)
                       from public.inventory i
                       where i.user_id = uid and i.qty > 0
                         and public._sell_price(i.item_id, stall) is not null), '[]'::jsonb),
    'seeds', (select jsonb_agg(jsonb_build_object('crop', c, 'price', public._seed_price(c)))
              from unnest(public._seed_offers(uid, today)) c),
    'orders', coalesce((select jsonb_agg(jsonb_build_object(
                          'slot', o.slot, 'crop', o.crop_id, 'qty', o.qty, 'coins', o.coins,
                          'done', exists (select 1 from public.order_deliveries x
                                          where x.user_id = uid and x.date = today and x.slot = o.slot))
                          order by o.slot)
                        from public._orders(uid, today) o), '[]'::jsonb),
    'exchange', jsonb_build_object(
      'price', 150, 'max', 2,
      'used', (select count(*) from public.ticket_exchanges where user_id = uid and week_start = wk)));
end $$;

-- Everything seasonal the shop and the Seed-dex show:
-- {today, month, crop, phase, seed: {crop, price} | null, mult, order: {crop, qty, coins, done} | null}
create or replace function public.season_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  d date;
  crop text;
  seed text;
  market text;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  d := public._season_day(uid);
  crop := public._season_crop(extract(month from d)::integer);
  seed := public._season_seed_on(d);
  market := public._season_market_on(d);
  return jsonb_build_object(
    'today', d,
    'month', extract(month from d)::integer,
    'crop', crop,
    'phase', case when extract(day from d) <= 14 then 'planting' else 'market' end,
    'seed', case when seed is not null then jsonb_build_object('crop', seed, 'price', 80) end,
    'mult', case when market is not null then 1.5 else 1 end,
    'order', case when market is not null then jsonb_build_object(
               'crop', market, 'qty', 3, 'coins', public._season_order_coins(market),
               'done', exists (select 1 from public.seasonal_orders o
                               where o.user_id = uid and o.crop_id = market
                                 and o.year = public._season_year(market, d))) end);
end $$;

-- ---------- actions ----------
-- The seed shop also sells the month's seasonal seed in planting season.
create or replace function public.buy_seed(p_crop text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  price integer;
  seasonal boolean := false;
  left_coins integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  perform 1 from public.game_state where user_id = uid for update;
  if p_crop = any (public._seed_offers(uid, public._wake_day(uid))) then
    price := public._seed_price(p_crop);
  elsif p_crop = public._season_seed_on(public._season_day(uid)) then
    price := 80;
    seasonal := true;
  else
    raise exception 'not in the shop today' using errcode = '22023';
  end if;
  update public.game_state set coins = coins - price where user_id = uid and coins >= price
  returning coins into left_coins;
  if not found then
    raise exception 'not enough coins' using errcode = 'P0001';
  end if;
  insert into public.inventory (user_id, item_id, qty) values (uid, 'seed:' || p_crop, 1)
  on conflict (user_id, item_id) do update set qty = public.inventory.qty + 1, updated_at = now();
  insert into public.events (user_id, type, payload)
  values (uid, 'seed_bought', jsonb_build_object('crop', p_crop, 'price', price, 'seasonal', seasonal));
  return jsonb_build_object('crop', p_crop, 'coins', left_coins);
end $$;

create or replace function public.sell_produce(p_item text, p_qty integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  season numeric;
  price integer;
  earned integer;
  left_coins integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_qty is null or p_qty < 1 or p_qty > 999 then
    raise exception 'bad quantity' using errcode = '22023';
  end if;
  -- One stock change at a time per user: selling and delivering race for the same produce
  -- (G7 ECON E1).
  perform 1 from public.game_state where user_id = uid for update;
  season := public._season_mult(p_item, public._season_day(uid));
  price := public._sell_price(p_item, public._upgrade_level(uid, 'stall'), season);
  if price is null then
    raise exception 'not for sale' using errcode = '22023';
  end if;
  update public.inventory set qty = qty - p_qty, updated_at = now()
  where user_id = uid and item_id = p_item and qty >= p_qty;
  if not found then
    raise exception 'not enough to sell' using errcode = 'P0001';
  end if;
  earned := price * p_qty;
  update public.game_state set coins = coins + earned where user_id = uid returning coins into left_coins;
  insert into public.events (user_id, type, payload)
  values (uid, 'produce_sold', jsonb_build_object('item', p_item, 'qty', p_qty, 'coins', earned, 'season', season));
  return jsonb_build_object('earned', earned, 'coins', left_coins);
end $$;

-- Deliver the seasonal market's special order (lowest quality first, like daily orders).
create or replace function public.deliver_seasonal_order()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  d date;
  crop text;
  yr integer;
  coins_due integer;
  need integer := 3;
  inv record;
  take integer;
  left_coins integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  perform 1 from public.game_state where user_id = uid for update;
  d := public._season_day(uid);
  crop := public._season_market_on(d);
  if crop is null then
    raise exception 'no seasonal market today' using errcode = 'P0001';
  end if;
  yr := public._season_year(crop, d);
  coins_due := public._season_order_coins(crop);
  begin
    insert into public.seasonal_orders (user_id, crop_id, year, qty, coins)
    values (uid, crop, yr, need, coins_due);
  exception when unique_violation then
    raise exception 'already delivered' using errcode = 'P0001';
  end;
  for inv in
    select item_id, qty from public.inventory
    where user_id = uid and qty > 0 and (item_id = 'crop:' || crop or item_id like 'crop:' || crop || ':%')
    order by array_position(array['normal', 'silver', 'gold', 'prismatic'],
                            coalesce(split_part(item_id, ':', 3), '')) nulls first,
             public._sell_price(item_id, 0), item_id
    for update
  loop
    exit when need = 0;
    take := least(need, inv.qty);
    update public.inventory set qty = qty - take, updated_at = now() where user_id = uid and item_id = inv.item_id;
    need := need - take;
  end loop;
  if need > 0 then
    raise exception 'not enough produce' using errcode = 'P0001';
  end if;
  update public.game_state set coins = coins + coins_due where user_id = uid returning coins into left_coins;
  insert into public.events (user_id, type, payload)
  values (uid, 'seasonal_order_delivered',
          jsonb_build_object('crop', crop, 'year', yr, 'qty', 3, 'coins', coins_due));
  return jsonb_build_object('coins', left_coins, 'earned', coins_due);
end $$;

-- ---------- grants (replaced functions keep theirs) ----------
revoke all on function public._season_crop(integer) from public, anon, authenticated;
revoke all on function public._season_month(text) from public, anon, authenticated;
revoke all on function public._season_seed_on(date) from public, anon, authenticated;
revoke all on function public._season_market_on(date) from public, anon, authenticated;
revoke all on function public._season_mult(text, date) from public, anon, authenticated;
revoke all on function public._season_year(text, date) from public, anon, authenticated;
revoke all on function public._season_order_coins(text) from public, anon, authenticated;
revoke all on function public._season_day(uuid) from public, anon, authenticated;
revoke all on function public._sell_price(text, integer, numeric) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['market_status()', 'season_status()', 'buy_seed(text)', 'sell_produce(text, integer)',
                           'deliver_seasonal_order()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
