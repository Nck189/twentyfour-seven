-- Review fix F5 (docs/REVIEW_FIX_PLAN.md): short scenes at milestones. Mirrors content/story.ts;
-- claim_story_beat re-checks every trigger. None pays anything (the milestones already do).
--   ch7_perfect_day    the first perfect day
--   ch8_thirty_days    best streak ≥ 30
--   ch10_first_batch   the first factory batch collected
--   ch11_welcome_back  back after days away (a welcome back claimed in the last 7 days)
-- _story_gift is unchanged: these beats return null.

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
    -- Days the app was used, not a streak: live "I'm up" presses since the account was made (G7
    -- R2-1: filled-in days and days before sign-up never count; backfill reaches 30 days back).
    'days_used', (select count(distinct w.date) from public.wake_events w, tz
                  where w.user_id = uid and not w.backfilled
                    and w.date >= coalesce((select (p.created_at at time zone tz.name)::date
                                            from public.profiles p where p.user_id = uid), w.date)),
    'house', public._upgrade_level(uid, 'house'),
    -- Review fix F5 (milestone scenes): perfect days, factory batches collected, welcome backs.
    'perfect_days', (select count(*) from public.day_results d where d.user_id = uid and d.kind = 'perfect'),
    'made', (select count(*) from public.events e where e.user_id = uid and e.type = 'jobs_collected'),
    -- Only a welcome back in the last 7 days: an old one (before this scene existed) stays old.
    'welcome_backs', (select count(*) from public.ticket_grants g
                      where g.user_id = uid and g.reason = 'welcome_back'
                        and g.ref_date > public._season_day(uid) - 7)
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
    when 'ch7_perfect_day' then (f ->> 'perfect_days')::integer >= 1
    when 'ch8_thirty_days' then (f ->> 'best_streak')::integer >= 30
    when 'ch10_first_batch' then (f ->> 'made')::integer >= 1
    when 'ch11_welcome_back' then (f ->> 'welcome_backs')::integer >= 1
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
