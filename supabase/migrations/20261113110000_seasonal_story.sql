-- Seasonal crop story beats (docs/STORY.md "Seasonal crops and their story beats"): November's
-- Candle Lotus has three beats (opening on day 1+, market on day 15+, and "use" after the first
-- sale or delivery), each once per crop per year: story_seen records them as '<beat>:<year>'.
-- The use beat floats an optional private wish. Mirrors content/story.ts
-- (tests/integration/story.test.ts checks the gifts; seasonal-story.test.ts the rules).

-- ---------- tables ----------

-- "Float a wish" (Candle Lotus): an optional private wish, one per season-year. Next year at Loy
-- Krathong Som brings it back (returned_at marks that; the return scene comes later). The user can
-- read and delete their own wishes; only float_wish writes them.
create table if not exists public.wishes (
  user_id uuid not null references auth.users (id) on delete cascade,
  year smallint not null,
  wish text not null check (char_length(btrim(wish)) between 1 and 120),
  floated_at timestamptz not null default now(),
  returned_at timestamptz,
  primary key (user_id, year)
);
alter table public.wishes enable row level security;
alter table public.wishes force row level security;
create policy "own rows: select" on public.wishes for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own rows: delete" on public.wishes for delete to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.wishes from anon, authenticated;
grant select, delete on public.wishes to authenticated;

-- ---------- story: seasonal beats (content/story.ts) ----------
-- The seasonal crop a beat belongs to; null = not a seasonal beat.
create or replace function public._story_season_crop(p_beat text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_beat in ('lotus_open', 'lotus_market', 'lotus_use') then 'candle_lotus' end
$$;

-- What the beats count, from server facts. season_uses = '<crop>:<season-year>' for each seasonal
-- crop sold or delivered (by the event's local date).
create or replace function public._story_facts(uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with tz as (
    select coalesce((select p.timezone from public.profiles p where p.user_id = uid), 'Asia/Bangkok') as name
  ), uses as (
    select split_part(e.payload ->> 'item', ':', 2) as crop, e.at from public.events e
    where e.user_id = uid and e.type = 'produce_sold'
    union all
    select e.payload ->> 'crop', e.at from public.events e
    where e.user_id = uid and e.type in ('order_delivered', 'seasonal_order_delivered')
  )
  select jsonb_build_object(
    'harvests', (select count(*) from public.events e where e.user_id = uid and e.type = 'harvest'),
    'good_days', (select count(*) from public.day_results d
                  where d.user_id = uid and d.kind in ('perfect', 'minimum')),
    'day', public._season_day(uid),
    'season_uses', coalesce((select jsonb_agg(distinct u.crop || ':'
                                              || public._season_year(u.crop, (u.at at time zone tz.name)::date))
                             from uses u, tz
                             where public._season_month(u.crop) is not null), '[]'::jsonb)
  )
$$;

-- null = unknown beat.
create or replace function public._story_ready(uid uuid, p_beat text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  f jsonb := public._story_facts(uid);
  d date := (f ->> 'day')::date;
  crop text := public._story_season_crop(p_beat);
begin
  return case p_beat
    when 'ch0_gate' then true
    when 'ch1_first_harvest' then (f ->> 'harvests')::integer >= 1
    when 'ch2_watering_can' then (f ->> 'good_days')::integer >= 3
    when 'lotus_open' then extract(month from d)::integer = public._season_month(crop)
    when 'lotus_market' then extract(month from d)::integer = public._season_month(crop)
                             and extract(day from d) >= 15
    when 'lotus_use' then (f -> 'season_uses') ? (crop || ':' || public._season_year(crop, d))
  end;
end $$;

create or replace function public._story_gift(p_beat text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case p_beat
    when 'ch1_first_harvest' then '{"seed": {"crop": "radish", "n": 1}}'::jsonb
    when 'ch2_watering_can' then '{"tickets": 1}'::jsonb
    when 'lotus_open' then '{"seed": {"crop": "candle_lotus", "n": 1}}'::jsonb
  end
$$;

-- The key a beat is recorded under: the beat, or '<beat>:<season-year>' for a seasonal one.
create or replace function public._story_key(uid uuid, p_beat text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when public._story_season_crop(p_beat) is null then p_beat
              else p_beat || ':' || public._season_year(public._story_season_crop(p_beat), public._season_day(uid)) end
$$;

-- Records a beat as seen (once — once per year for a seasonal beat — one per wake-day, only when
-- its trigger holds) and grants its gift.
create or replace function public.claim_story_beat(p_beat text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  ready boolean;
  gift jsonb := public._story_gift(p_beat);
  k text;
  d date;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  ready := public._story_ready(uid, p_beat);
  if ready is null then
    raise exception 'unknown beat' using errcode = '22023';
  end if;
  -- Serialize this user's claims (parallel taps / tabs).
  perform 1 from public.game_state where user_id = uid for update;
  k := public._story_key(uid, p_beat);
  if exists (select 1 from public.story_seen where user_id = uid and beat = k) then
    raise exception 'already seen' using errcode = 'P0001';
  end if;
  d := public._wake_day(uid);
  if exists (select 1 from public.story_seen where user_id = uid and day = d) then
    raise exception 'one beat a day' using errcode = 'P0001';
  end if;
  if not ready then
    raise exception 'not yet' using errcode = 'P0001';
  end if;
  insert into public.story_seen (user_id, beat, day, gift) values (uid, k, d, gift);
  if gift ? 'tickets' then
    update public.game_state set tickets = tickets + (gift ->> 'tickets')::integer where user_id = uid;
  end if;
  if gift ? 'seed' then
    insert into public.inventory (user_id, item_id, qty)
    values (uid, 'seed:' || (gift -> 'seed' ->> 'crop'), (gift -> 'seed' ->> 'n')::integer)
    on conflict (user_id, item_id) do update set qty = public.inventory.qty + excluded.qty;
  end if;
  insert into public.events (user_id, type, payload)
  values (uid, 'story_seen', jsonb_build_object('beat', p_beat, 'key', k, 'gift', gift));
  return jsonb_build_object('beat', p_beat, 'key', k, 'gift', gift);
end $$;

-- Float a wish (after this year's Candle Lotus "use" beat). Optional: skipping writes nothing.
-- The event never carries the wish's text.
create or replace function public.float_wish(p_wish text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  w text := btrim(p_wish);
  yr integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if w is null or char_length(w) < 1 or char_length(w) > 120 then
    raise exception 'a wish is 1–120 characters' using errcode = '22023';
  end if;
  perform 1 from public.game_state where user_id = uid for update;
  yr := public._season_year('candle_lotus', public._season_day(uid));
  if not exists (select 1 from public.story_seen where user_id = uid and beat = 'lotus_use:' || yr) then
    raise exception 'not yet' using errcode = 'P0001';
  end if;
  begin
    insert into public.wishes (user_id, year, wish) values (uid, yr, w);
  exception when unique_violation then
    raise exception 'already floated' using errcode = 'P0001';
  end;
  insert into public.events (user_id, type, payload)
  values (uid, 'wish_floated', jsonb_build_object('year', yr));
  return jsonb_build_object('year', yr);
end $$;

-- ---------- grants ----------
revoke all on function public._story_season_crop(text) from public, anon, authenticated;
revoke all on function public._story_key(uuid, text) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['claim_story_beat(text)', 'float_wish(text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
