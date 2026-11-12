-- Som's café (docs/STORY.md, Minnie 2026-11-12). Ordering is a game: a stamp per order; the first
-- full card of 10 gives the café table decor, later cards are just a celebration (no coins: G7
-- R-C1, the café must never mint currency). Whether you drank one in real life is a separate
-- answer, asked only after a caffeinated drink (G7 R-C4), at most once a wake-day (yes / later /
-- just playing); "later", or leaving the question unanswered (G7 R-C6), gets one bedtime answer.
-- "Yes" days can add another real cup later (G7 R-C5): the slot keeps the latest time of day.
-- Mirrors content/cafe.ts.

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
  -- The caffeinated drink the question followed (null for a bedtime-only answer).
  drink text,
  -- yes: the latest real cup's time of day; later: the bedtime answer (none = no caffeine), else null.
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
                     'cafe_order', 'cafe_card', 'coffee_answered', 'coffee_cup_added')
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

-- Drinks the real-life question follows (coffee and tea; not cocoa or water).
create or replace function public._cafe_caffeine(p_drink text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_drink in ('americano', 'latte', 'thai_iced_coffee', 'thai_tea', 'matcha', 'jasmine_tea')
$$;

create or replace function public._coffee_slot_rank(p_slot text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_slot when 'morning' then 1 when 'afternoon' then 2 when 'evening' then 3 else 0 end
$$;

-- The last caffeinated order of this wake-day (null if none).
create or replace function public._cafe_last_caffeine(uid uuid, d date)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select o.drink from public.cafe_orders o
  where o.user_id = uid and o.day = d and public._cafe_caffeine(o.drink)
  order by o.id desc limit 1
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
      values (uid, 'cafe_table', (select count(*) from public.decor where user_id = uid), 0);
    else
      -- Later cards: a celebration only (the card's number), never currency (G7 R-C1).
      reward := jsonb_build_object('card', n / public._cafe_card_size());
    end if;
    insert into public.events (user_id, type, payload)
    values (uid, 'cafe_card', jsonb_build_object('stamps', n, 'reward', reward));
  end if;
  ask := public._cafe_caffeine(p_drink)
         and not coalesce((select p.cafe_game_only from public.profiles p where p.user_id = uid), false)
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
  drink text;
  inserted integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_answer not in ('yes', 'later', 'play') then
    raise exception 'unknown answer' using errcode = '22023';
  end if;
  d := public._wake_day(uid);
  drink := public._cafe_last_caffeine(uid, d);
  if drink is null then
    raise exception 'no coffee or tea ordered today' using errcode = 'P0001';
  end if;
  insert into public.coffee_answers (user_id, day, answer, drink, slot)
  values (uid, d, p_answer, drink, case when p_answer = 'yes' then public._coffee_slot(uid, now()) end)
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    raise exception 'already answered today' using errcode = 'P0001';
  end if;
  insert into public.events (user_id, type, payload)
  values (uid, 'coffee_answered', jsonb_build_object('answer', p_answer));
end $$;

-- The bedtime answer, once: after "later", or after a caffeinated order whose question was left
-- unanswered (closed the app, switched tabs: G7 R-C6). Never after "yes" or "just playing".
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
  if coalesce((select p.cafe_game_only from public.profiles p where p.user_id = uid), false) then
    raise exception 'the café is game-only' using errcode = 'P0001';
  end if;
  update public.coffee_answers set slot = p_slot, night_at = now()
  where user_id = uid and day = d and answer = 'later' and night_at is null;
  get diagnostics updated = row_count;
  if updated = 0 and public._cafe_last_caffeine(uid, d) is not null then
    insert into public.coffee_answers (user_id, day, answer, slot, night_at)
    values (uid, d, 'later', p_slot, now())
    on conflict do nothing;
    get diagnostics updated = row_count;
  end if;
  if updated = 0 then
    raise exception 'nothing to answer tonight' using errcode = 'P0001';
  end if;
  insert into public.events (user_id, type, payload)
  values (uid, 'coffee_answered', jsonb_build_object('night', p_slot));
end $$;

-- "I had another real one": on a "yes" day, keep the latest time of day (G7 R-C5), so a morning
-- cup plus an afternoon one counts as an afternoon-coffee day. Returns the slot now recorded.
create or replace function public.add_real_cup()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  d date;
  now_slot text;
  s text;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  d := public._wake_day(uid);
  now_slot := public._coffee_slot(uid, now());
  update public.coffee_answers a
  set slot = case when public._coffee_slot_rank(now_slot) > public._coffee_slot_rank(a.slot)
                  then now_slot else a.slot end
  where a.user_id = uid and a.day = d and a.answer = 'yes'
  returning a.slot into s;
  if s is null then
    raise exception 'only after a yes today' using errcode = 'P0001';
  end if;
  insert into public.events (user_id, type, payload)
  values (uid, 'coffee_cup_added', jsonb_build_object('slot', s));
  return s;
end $$;

-- What the café sheet and the Night ritual need: {stamps, answer (today's, or null), night (the
-- bedtime answer is in), game_only, ordered (a caffeinated order today)}.
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
    'ordered', public._cafe_last_caffeine(uid, d) is not null,
    'game_only', coalesce((select p.cafe_game_only from public.profiles p where p.user_id = uid), false));
end $$;

revoke all on function public._cafe_drink_ok(text) from public, anon, authenticated;
revoke all on function public._cafe_card_size() from public, anon, authenticated;
revoke all on function public._coffee_slot(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public._cafe_caffeine(text) from public, anon, authenticated;
revoke all on function public._coffee_slot_rank(text) from public, anon, authenticated;
revoke all on function public._cafe_last_caffeine(uuid, date) from public, anon, authenticated;
revoke all on function public.add_real_cup() from public, anon;
grant execute on function public.add_real_cup() to authenticated;
revoke all on function public.order_drink(text) from public, anon;
revoke all on function public.answer_coffee(text) from public, anon;
revoke all on function public.answer_coffee_night(text) from public, anon;
revoke all on function public.cafe_status() from public, anon;
grant execute on function public.cafe_status() to authenticated;
grant execute on function public.order_drink(text) to authenticated;
grant execute on function public.answer_coffee(text) to authenticated;
grant execute on function public.answer_coffee_night(text) to authenticated;
