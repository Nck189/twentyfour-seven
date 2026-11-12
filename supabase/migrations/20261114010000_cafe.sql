-- Som's café (docs/STORY.md, Minnie 2026-11-12). Ordering is a game (a stamp per order; a full card
-- of 10 gives the café table decor the first time, then a few coins). Whether you drank one in real
-- life is a separate answer: right after an order at most once a wake-day (yes / later / just
-- playing), and one bedtime answer only after "later". Mirrors content/cafe.ts.

alter table public.profiles add column if not exists cafe_game_only boolean not null default false;
-- Profiles use column grants (m10): the More toggle "use the café in the game only" is the user's own.
grant update (cafe_game_only) on public.profiles to authenticated;

create table public.cafe_orders (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  drink text not null,
  day date not null,
  at timestamptz not null default now()
);
create index cafe_orders_user on public.cafe_orders (user_id, day);
alter table public.cafe_orders enable row level security;
alter table public.cafe_orders force row level security;
create policy "own rows: select" on public.cafe_orders for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.cafe_orders from anon, authenticated;
grant select on public.cafe_orders to authenticated;

create table public.coffee_answers (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  answer text not null check (answer in ('yes', 'later', 'play')),
  -- yes: the order's time of day; later: the bedtime answer (none = no coffee), else null.
  slot text check (slot in ('none', 'morning', 'afternoon', 'evening')),
  at timestamptz not null default now(),
  night_at timestamptz,
  primary key (user_id, day)
);
alter table public.coffee_answers enable row level security;
alter table public.coffee_answers force row level security;
create policy "own rows: select" on public.coffee_answers for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.coffee_answers from anon, authenticated;
grant select on public.coffee_answers to authenticated;

-- Server-written events only (adds the café ones).
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
                     'cafe_order', 'cafe_card', 'coffee_answered')
  );

create or replace function public._cafe_drink_ok(p_drink text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_drink in ('americano', 'latte', 'thai_iced_coffee', 'thai_tea', 'matcha', 'cocoa',
                     'jasmine_tea', 'water')
$$;

create or replace function public._cafe_card_size()
returns integer
language sql
immutable
set search_path = ''
as $$ select 10 $$;

-- Morning before noon, afternoon until 17:00, then evening (lib/game/cafe.ts slotOf), local time.
create or replace function public._coffee_slot(uid uuid, p_at timestamptz)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when extract(hour from p_at at time zone tz) < 12 then 'morning'
    when extract(hour from p_at at time zone tz) < 17 then 'afternoon'
    else 'evening'
  end
  from (select coalesce((select p.timezone from public.profiles p where p.user_id = uid),
                        'Asia/Bangkok') as tz) t
$$;

-- {stamps, reward: {decor}|{coins}|null, ask: boolean}
create or replace function public.order_drink(p_drink text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  d date;
  n integer;
  reward jsonb := null;
  ask boolean;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not public._cafe_drink_ok(p_drink) then
    raise exception 'unknown drink' using errcode = '22023';
  end if;
  if public._upgrade_level(uid, 'house') < 2 then
    raise exception 'the café opens with the Farmhouse at level 2' using errcode = 'P0001';
  end if;
  perform 1 from public.game_state where user_id = uid for update;
  d := public._wake_day(uid);
  insert into public.cafe_orders (user_id, drink, day) values (uid, p_drink, d);
  select count(*) into n from public.cafe_orders where user_id = uid;
  insert into public.events (user_id, type, payload)
  values (uid, 'cafe_order', jsonb_build_object('drink', p_drink, 'stamps', n));
  if n % public._cafe_card_size() = 0 then
    if n = public._cafe_card_size() then
      reward := '{"decor": "cafe_table"}'::jsonb;
      insert into public.decor (user_id, item_id, x, y)
      values (uid, 'cafe_table',
              (select count(*) from public.decor where user_id = uid and item_id = 'cafe_table'), 0);
    else
      reward := '{"coins": 20}'::jsonb;
      update public.game_state set coins = coins + 20 where user_id = uid;
    end if;
    insert into public.events (user_id, type, payload)
    values (uid, 'cafe_card', jsonb_build_object('stamps', n, 'reward', reward));
  end if;
  ask := not coalesce((select p.cafe_game_only from public.profiles p where p.user_id = uid), false)
         and not exists (select 1 from public.coffee_answers a where a.user_id = uid and a.day = d);
  return jsonb_build_object('stamps', n, 'reward', reward, 'ask', ask);
end $$;

-- The answer right after an order: once a wake-day. "yes" records the time of day now.
create or replace function public.answer_coffee(p_answer text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  d date;
  inserted integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_answer not in ('yes', 'later', 'play') then
    raise exception 'unknown answer' using errcode = '22023';
  end if;
  d := public._wake_day(uid);
  insert into public.coffee_answers (user_id, day, answer, slot)
  values (uid, d, p_answer, case when p_answer = 'yes' then public._coffee_slot(uid, now()) end)
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    raise exception 'already answered today' using errcode = 'P0001';
  end if;
  insert into public.events (user_id, type, payload)
  values (uid, 'coffee_answered', jsonb_build_object('answer', p_answer));
end $$;

-- The bedtime answer: only after "later", once.
create or replace function public.answer_coffee_night(p_slot text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  d date;
  updated integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_slot not in ('none', 'morning', 'afternoon', 'evening') then
    raise exception 'unknown slot' using errcode = '22023';
  end if;
  d := public._wake_day(uid);
  update public.coffee_answers set slot = p_slot, night_at = now()
  where user_id = uid and day = d and answer = 'later' and night_at is null;
  get diagnostics updated = row_count;
  if updated = 0 then
    raise exception 'nothing to answer tonight' using errcode = 'P0001';
  end if;
  insert into public.events (user_id, type, payload)
  values (uid, 'coffee_answered', jsonb_build_object('night', p_slot));
end $$;

-- What the café sheet and the Night ritual need: {stamps, answer (today's, or null), night (the
-- bedtime answer is in), game_only}.
create or replace function public.cafe_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  d date;
  a public.coffee_answers;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  d := public._wake_day(uid);
  select * into a from public.coffee_answers c where c.user_id = uid and c.day = d;
  return jsonb_build_object(
    'stamps', (select count(*) from public.cafe_orders o where o.user_id = uid),
    'answer', a.answer,
    'night', a.night_at is not null,
    'game_only', coalesce((select p.cafe_game_only from public.profiles p where p.user_id = uid), false));
end $$;

revoke all on function public._cafe_drink_ok(text) from public, anon, authenticated;
revoke all on function public._cafe_card_size() from public, anon, authenticated;
revoke all on function public._coffee_slot(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.order_drink(text) from public, anon;
revoke all on function public.answer_coffee(text) from public, anon;
revoke all on function public.answer_coffee_night(text) from public, anon;
revoke all on function public.cafe_status() from public, anon;
grant execute on function public.cafe_status() to authenticated;
grant execute on function public.order_drink(text) to authenticated;
grant execute on function public.answer_coffee(text) to authenticated;
grant execute on function public.answer_coffee_night(text) to authenticated;
