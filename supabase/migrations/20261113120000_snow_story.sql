-- December's Snow Strawberry beats (docs/STORY.md "Seasonal crops"), the same rules as the Candle
-- Lotus ones: opening on Dec 1+ (a seed), the winter-lights market on Dec 15+, and the use beat
-- after the first sale or delivery, which shows the year-end cake and a year in review.
-- Mirrors content/story.ts (tests/integration/snow-story.test.ts).

create or replace function public._story_season_crop(p_beat text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_beat in ('lotus_open', 'lotus_market', 'lotus_use') then 'candle_lotus'
    when p_beat in ('snow_open', 'snow_market', 'snow_use') then 'snow_strawberry'
  end
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
    when 'lotus_open' then '{"seed": {"crop": "candle_lotus", "n": 1}}'::jsonb
    when 'snow_open' then '{"seed": {"crop": "snow_strawberry", "n": 1}}'::jsonb
  end
$$;

-- The year in review for the year-end cake (Snow Strawberry use beat): this user's own year. The
-- year is the beat's season-year (G7 R-C2): a first sale on 4 Jan 2027 is still 2026's cake.
-- {year, harvests, best_streak (all-time, labelled "so far"), mornings}.
create or replace function public.year_review()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  y integer;
  tz text;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  y := public._season_year('snow_strawberry', public._season_day(uid));
  tz := coalesce((select p.timezone from public.profiles p where p.user_id = uid), 'Asia/Bangkok');
  return jsonb_build_object(
    'year', y,
    'harvests', (select count(*) from public.events e
                 where e.user_id = uid and e.type = 'harvest'
                   and extract(year from (e.at at time zone tz))::integer = y),
    'best_streak', coalesce((select g.best_streak from public.game_state g where g.user_id = uid), 0),
    'mornings', (select count(*) from public.wake_events w
                 where w.user_id = uid and w.in_window and not w.backfilled
                   and extract(year from w.date)::integer = y)
  );
end $$;

revoke all on function public.year_review() from public, anon;
grant execute on function public.year_review() to authenticated;
