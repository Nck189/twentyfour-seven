-- Economy v2 step 2 (docs/ECONOMY.md, Minnie OK 2026-11-11): the market, the seed shop, the
-- ticket exchange, tiered upgrades, daily orders and the reward jar. Every coin and ticket change
-- happens here; the client only asks. Numbers mirror content/economy.ts (tests check they match).

-- ---------- tables ----------
create table if not exists public.upgrades (
  user_id uuid not null references auth.users (id) on delete cascade,
  track text not null check (track in ('stall', 'barn', 'house')),
  level smallint not null default 0 check (level between 0 and 3),
  updated_at timestamptz not null default now(),
  primary key (user_id, track)
);
alter table public.upgrades enable row level security;
alter table public.upgrades force row level security;
create policy "own rows: select" on public.upgrades for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.upgrades from anon;
revoke insert, update, delete, truncate on public.upgrades from authenticated;

create table if not exists public.order_deliveries (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  slot smallint not null check (slot between 0 and 2),
  crop_id text not null,
  qty smallint not null check (qty between 1 and 3),
  coins integer not null check (coins > 0),
  at timestamptz not null default now(),
  primary key (user_id, date, slot)
);
alter table public.order_deliveries enable row level security;
alter table public.order_deliveries force row level security;
create policy "own rows: select" on public.order_deliveries for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.order_deliveries from anon;
revoke insert, update, delete, truncate on public.order_deliveries from authenticated;

create table if not exists public.ticket_exchanges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  coins integer not null,
  at timestamptz not null default now()
);
create index if not exists ticket_exchanges_week on public.ticket_exchanges (user_id, week_start);
alter table public.ticket_exchanges enable row level security;
alter table public.ticket_exchanges force row level security;
create policy "own rows: select" on public.ticket_exchanges for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.ticket_exchanges from anon;
revoke insert, update, delete, truncate on public.ticket_exchanges from authenticated;

-- The reward jar: the user's own real-life rewards. Titles and costs are theirs to edit; only
-- redeeming (which spends coins) goes through an RPC.
create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 60),
  cost integer not null check (cost between 10 and 10000),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.rewards enable row level security;
alter table public.rewards force row level security;
create policy "own rows: select" on public.rewards for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows: insert" on public.rewards for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own rows: update" on public.rewards for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows: delete" on public.rewards for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.rewards from anon;

create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reward_id uuid references public.rewards (id) on delete set null,
  title text not null,
  cost integer not null,
  at timestamptz not null default now()
);
alter table public.reward_redemptions enable row level security;
alter table public.reward_redemptions force row level security;
create policy "own rows: select" on public.reward_redemptions for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.reward_redemptions from anon;
revoke insert, update, delete, truncate on public.reward_redemptions from authenticated;

-- Server-written events only.
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
                     'order_delivered', 'reward_redeemed')
  );

-- ---------- prices (mirror content/economy.ts) ----------
create or replace function public._crop_rarity(p_crop text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case public._crop_grow_days(p_crop)
    when 1 then 'common' when 2 then 'uncommon' when 3 then 'rare' when 5 then 'epic' when 7 then 'legendary' end
$$;

create or replace function public._sell_base(p_rarity text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_rarity when 'common' then 6 when 'uncommon' then 10 when 'rare' then 16
                       when 'epic' then 30 when 'legendary' then 60 end
$$;

create or replace function public._upgrade_level(uid uuid, p_track text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select level from public.upgrades where user_id = uid and track = p_track), 0)::integer
$$;

-- One unit's price at a stall level; null when the item can't be sold.
create or replace function public._sell_price(p_item text, p_stall integer)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  parts text[] := string_to_array(p_item, ':');
  stall numeric := 1 + 0.1 * p_stall;
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
    return round(base * stall);
  end if;
  if array_length(parts, 1) <> 4 or parts[4] !~ '^\d+$' then
    return null;
  end if;
  q := case parts[3] when 'normal' then 1 when 'silver' then 1.25 when 'gold' then 1.5 when 'prismatic' then 2 end;
  if q is null then
    return null;
  end if;
  m := least(parts[4]::numeric / 100, 4);
  return round(base * q * m * stall);
end $$;

-- ---------- daily offers and orders (picked from a hash of user + wake-day) ----------
create or replace function public._seed_offers(uid uuid, d date)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array(
    (select c from unnest(array['strawberry', 'blueberry', 'tomato', 'corn']) c
     order by md5(uid::text || d::text || c) limit 2)
    union all
    (select c from unnest(array['pumpkin', 'melon', 'sunflower', 'coffee']) c
     order by md5(uid::text || d::text || c) limit 1))
$$;

create or replace function public._seed_price(p_crop text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case public._crop_rarity(p_crop) when 'uncommon' then 30 when 'rare' then 80 end
$$;

-- Today's orders: 1 + barn level, each 1–3 of a crop the user has harvested (or a starter).
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
  where public._crop_rarity(x) is not null;
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

-- ---------- status (everything the shop shows) ----------
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
  stall integer;
  wk date;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  today := public._wake_day(uid);
  wk := today - ((extract(isodow from today)::integer) - 1);
  stall := public._upgrade_level(uid, 'stall');
  return jsonb_build_object(
    'today', today,
    'coins', coalesce((select coins from public.game_state where user_id = uid), 0),
    'levels', jsonb_build_object(
      'stall', stall,
      'barn', public._upgrade_level(uid, 'barn'),
      'house', public._upgrade_level(uid, 'house')),
    'shelf', coalesce((select jsonb_agg(jsonb_build_object('item', i.item_id, 'qty', i.qty,
                                                           'price', public._sell_price(i.item_id, stall))
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

-- ---------- actions ----------
create or replace function public.sell_produce(p_item text, p_qty integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
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
  price := public._sell_price(p_item, public._upgrade_level(uid, 'stall'));
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
  values (uid, 'produce_sold', jsonb_build_object('item', p_item, 'qty', p_qty, 'coins', earned));
  return jsonb_build_object('earned', earned, 'coins', left_coins);
end $$;

create or replace function public.buy_seed(p_crop text)
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
  if not (p_crop = any (public._seed_offers(uid, public._wake_day(uid)))) then
    raise exception 'not in the shop today' using errcode = '22023';
  end if;
  price := public._seed_price(p_crop);
  update public.game_state set coins = coins - price where user_id = uid and coins >= price
  returning coins into left_coins;
  if not found then
    raise exception 'not enough coins' using errcode = 'P0001';
  end if;
  insert into public.inventory (user_id, item_id, qty) values (uid, 'seed:' || p_crop, 1)
  on conflict (user_id, item_id) do update set qty = public.inventory.qty + 1, updated_at = now();
  insert into public.events (user_id, type, payload)
  values (uid, 'seed_bought', jsonb_build_object('crop', p_crop, 'price', price));
  return jsonb_build_object('crop', p_crop, 'coins', left_coins);
end $$;

create or replace function public.exchange_ticket()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date;
  wk date;
  left_coins integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  today := public._wake_day(uid);
  wk := today - ((extract(isodow from today)::integer) - 1);
  -- One at a time per user, so two taps can't both pass the weekly check.
  perform 1 from public.game_state where user_id = uid for update;
  if (select count(*) from public.ticket_exchanges where user_id = uid and week_start = wk) >= 2 then
    raise exception 'weekly limit reached' using errcode = 'P0001';
  end if;
  update public.game_state set coins = coins - 150 where user_id = uid and coins >= 150
  returning coins into left_coins;
  if not found then
    raise exception 'not enough coins' using errcode = 'P0001';
  end if;
  insert into public.ticket_exchanges (user_id, week_start, coins) values (uid, wk, 150);
  perform public._grant_tickets(uid, 1, 'exchange', jsonb_build_object('week', wk));
  insert into public.events (user_id, type, payload)
  values (uid, 'ticket_exchanged', jsonb_build_object('coins', 150, 'week', wk));
  return jsonb_build_object('coins', left_coins,
                            'tickets', (select tickets from public.game_state where user_id = uid));
end $$;

create or replace function public.buy_upgrade(p_track text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  lvl integer;
  prices integer[];
  price integer;
  left_coins integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  prices := case p_track when 'stall' then array[200, 500] when 'barn' then array[300, 800]
                         when 'house' then array[400, 1000, 2000] end;
  if prices is null then
    raise exception 'unknown upgrade' using errcode = '22023';
  end if;
  perform 1 from public.game_state where user_id = uid for update;
  lvl := public._upgrade_level(uid, p_track);
  price := prices[lvl + 1];
  if price is null then
    raise exception 'already at the top' using errcode = 'P0001';
  end if;
  update public.game_state set coins = coins - price where user_id = uid and coins >= price
  returning coins into left_coins;
  if not found then
    raise exception 'not enough coins' using errcode = 'P0001';
  end if;
  insert into public.upgrades (user_id, track, level) values (uid, p_track, lvl + 1)
  on conflict (user_id, track) do update set level = lvl + 1, updated_at = now();
  insert into public.events (user_id, type, payload)
  values (uid, 'upgrade_bought', jsonb_build_object('track', p_track, 'level', lvl + 1, 'price', price));
  return jsonb_build_object('track', p_track, 'level', lvl + 1, 'coins', left_coins);
end $$;

-- Deliver today's order `p_slot`: takes the lowest-quality matching produce first.
create or replace function public.deliver_order(p_slot integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date;
  o record;
  need integer;
  inv record;
  take integer;
  left_coins integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  -- Serialise with sells and other deliveries (G7 ECON E1): the stock read below must not change
  -- under us, and every unit is taken before the order pays.
  perform 1 from public.game_state where user_id = uid for update;
  today := public._wake_day(uid);
  select * into o from public._orders(uid, today) x where x.slot = p_slot;
  if not found then
    raise exception 'no such order' using errcode = '22023';
  end if;
  begin
    insert into public.order_deliveries (user_id, date, slot, crop_id, qty, coins)
    values (uid, today, p_slot, o.crop_id, o.qty, o.coins);
  exception when unique_violation then
    raise exception 'already delivered' using errcode = 'P0001';
  end;
  if coalesce((select sum(qty) from public.inventory
               where user_id = uid and (item_id = 'crop:' || o.crop_id or item_id like 'crop:' || o.crop_id || ':%')), 0)
     < o.qty then
    raise exception 'not enough produce' using errcode = 'P0001';
  end if;
  need := o.qty;
  for inv in
    select item_id, qty from public.inventory
    where user_id = uid and qty > 0 and (item_id = 'crop:' || o.crop_id or item_id like 'crop:' || o.crop_id || ':%')
    -- Lowest quality first (then weather, then the item id), as ECONOMY.md says.
    order by array_position(array['normal', 'silver', 'gold', 'prismatic'],
                            coalesce(split_part(item_id, ':', 3), '') ) nulls first,
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
  update public.game_state set coins = coins + o.coins where user_id = uid returning coins into left_coins;
  insert into public.events (user_id, type, payload)
  values (uid, 'order_delivered', jsonb_build_object('slot', p_slot, 'crop', o.crop_id, 'qty', o.qty, 'coins', o.coins));
  return jsonb_build_object('coins', left_coins, 'earned', o.coins);
end $$;

create or replace function public.redeem_reward(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  rw public.rewards;
  left_coins integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into rw from public.rewards where id = p_id and user_id = uid and not archived;
  if not found then
    raise exception 'no such reward' using errcode = 'P0002';
  end if;
  update public.game_state set coins = coins - rw.cost where user_id = uid and coins >= rw.cost
  returning coins into left_coins;
  if not found then
    raise exception 'not enough coins' using errcode = 'P0001';
  end if;
  insert into public.reward_redemptions (user_id, reward_id, title, cost) values (uid, rw.id, rw.title, rw.cost);
  insert into public.events (user_id, type, payload)
  values (uid, 'reward_redeemed', jsonb_build_object('reward', rw.id, 'cost', rw.cost));
  return jsonb_build_object('coins', left_coins);
end $$;

revoke all on function public._crop_rarity(text) from public, anon, authenticated;
revoke all on function public._sell_base(text) from public, anon, authenticated;
revoke all on function public._upgrade_level(uuid, text) from public, anon, authenticated;
revoke all on function public._sell_price(text, integer) from public, anon, authenticated;
revoke all on function public._seed_offers(uuid, date) from public, anon, authenticated;
revoke all on function public._seed_price(text) from public, anon, authenticated;
revoke all on function public._orders(uuid, date) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['market_status()', 'sell_produce(text, integer)', 'buy_seed(text)',
                           'exchange_ticket()', 'buy_upgrade(text)', 'deliver_order(integer)',
                           'redeem_reward(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
