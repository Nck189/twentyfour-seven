-- Story chapters 3–6 and the café opening (docs/STORY.md "Chapters"; Som's café "opens with a short
-- scene at Farmhouse level 2"). Mirrors content/story.ts; claim_story_beat re-checks every trigger.
--   ch3_new_friend  first animal hatched            —
--   ch4_sunset      best streak ≥ 7                 decor: farm sign
--   ch5_house       Farmhouse level ≥ 1             —
--   ch6_album       30 days used (not a streak)     2 tickets
--   cafe_open       Farmhouse level ≥ 2             —

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
                             where public._season_month(u.crop) is not null), '[]'::jsonb),
    'hatched', (select count(*) from public.animals a where a.user_id = uid),
    'best_streak', coalesce((select g.best_streak from public.game_state g where g.user_id = uid), 0),
    -- Days the app was used: wake-days with an "I'm up" (live or filled in later), not a streak.
    'days_used', (select count(distinct w.date) from public.wake_events w where w.user_id = uid),
    'house', public._upgrade_level(uid, 'house')
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
    when 'ch3_new_friend' then (f ->> 'hatched')::integer >= 1
    when 'ch4_sunset' then (f ->> 'best_streak')::integer >= 7
    when 'ch5_house' then (f ->> 'house')::integer >= 1
    when 'ch6_album' then (f ->> 'days_used')::integer >= 30
    when 'cafe_open' then (f ->> 'house')::integer >= 2
    when 'lotus_open' then extract(month from d)::integer = public._season_month(crop)
    when 'lotus_market' then extract(month from d)::integer = public._season_month(crop)
                             and extract(day from d) >= 15
    when 'lotus_use' then (f -> 'season_uses') ? (crop || ':' || public._season_year(crop, d))
    when 'snow_open' then extract(month from d)::integer = public._season_month(crop)
    when 'snow_market' then extract(month from d)::integer = public._season_month(crop)
                            and extract(day from d) >= 15
    when 'snow_use' then (f -> 'season_uses') ? (crop || ':' || public._season_year(crop, d))
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
    when 'ch4_sunset' then '{"decor": "farm_sign"}'::jsonb
    when 'ch6_album' then '{"tickets": 2}'::jsonb
    when 'lotus_open' then '{"seed": {"crop": "candle_lotus", "n": 1}}'::jsonb
    when 'snow_open' then '{"seed": {"crop": "snow_strawberry", "n": 1}}'::jsonb
  end
$$;

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
  if gift ? 'decor' then
    insert into public.decor (user_id, item_id, x, y)
    values (uid, gift ->> 'decor', (select count(*) from public.decor where user_id = uid), 0);
  end if;
  insert into public.events (user_id, type, payload)
  values (uid, 'story_seen', jsonb_build_object('beat', p_beat, 'key', k, 'gift', gift));
  return jsonb_build_object('beat', p_beat, 'key', k, 'gift', gift);
end $$;
