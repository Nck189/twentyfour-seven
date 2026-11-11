-- Playtest R1 R3 (Minnie OK 2026-11-11): coming back is welcomed, not scolded.
-- After 2+ away days in a row (nothing logged; see _away_day), Today shows a welcome card: one
-- tap claims a gift (+1 ticket, at most once a week). Then a 3-day "back on track" goal: 3 minimum
-- days (in-window "I'm up" + Night ritual) within 5 days of the welcome pay +2 tickets, once.
-- The client only asks; these functions decide.

alter table public.ticket_grants drop constraint if exists ticket_grants_reason_check;
alter table public.ticket_grants add constraint ticket_grants_reason_check
  check (reason in ('sunrise', 'night', 'perfect_day', 'weekly_review', 'streak_7', 'streak_14',
                    'streak_30', 'welcome_back', 'back_on_track'));

-- Away days in a row just before today (0 when yesterday was active). Null when the run reaches
-- back to the account's start: someone who never used the app isn't "coming back".
create or replace function public._away_run(uid uuid, p_today date)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  tz text;
  start_day date;
  d date := p_today - 1;
  n integer := 0;
begin
  select coalesce(timezone, 'Asia/Bangkok'), (created_at at time zone coalesce(timezone, 'Asia/Bangkok'))::date
    into tz, start_day
    from public.profiles where user_id = uid;
  while d >= start_day and n < 60 and public._away_day(uid, d) loop
    n := n + 1;
    d := d - 1;
  end loop;
  if d < start_day then
    return null;
  end if;
  return n;
end $$;

-- The latest welcome within the last week (the goal's start), or null.
create or replace function public._welcome_ref(uid uuid, p_today date)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select max(ref_date) from public.ticket_grants
  where user_id = uid and reason = 'welcome_back' and ref_date > p_today - 7
$$;

-- Minimum days (live in-window "I'm up" + the Night ticket) in the 5 days from w.
create or replace function public._back_on_track_days(uid uuid, w date, p_today date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from generate_series(w, least(w + 4, p_today), interval '1 day') g(day)
  where exists (select 1 from public.wake_events
                where user_id = uid and date = g.day::date and in_window and not backfilled)
    and exists (select 1 from public.ticket_grants
                where user_id = uid and reason = 'night' and ref_date = g.day::date)
$$;

create or replace function public.welcome_back_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date;
  run integer;
  w date;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  today := public._wake_day(uid);
  run := public._away_run(uid, today);
  w := public._welcome_ref(uid, today);
  return jsonb_build_object(
    'today', today,
    'away_days', coalesce(run, 0),
    'lapsed', coalesce(run, 0) >= 2 and w is null,
    'goal', case when w is null then null else jsonb_build_object(
      'start', w,
      'ends', w + 4,
      'done', public._back_on_track_days(uid, w, today),
      'need', 3,
      'claimed', exists (select 1 from public.ticket_grants
                         where user_id = uid and reason = 'back_on_track' and ref_date = w)) end);
end $$;

create or replace function public.claim_welcome_back()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date;
  run integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  today := public._wake_day(uid);
  run := public._away_run(uid, today);
  if coalesce(run, 0) < 2 or public._welcome_ref(uid, today) is not null then
    return jsonb_build_object('granted', false);
  end if;
  return jsonb_build_object('granted', public._grant_once(uid, 'welcome_back', today, 1), 'away_days', run);
end $$;

create or replace function public.claim_back_on_track()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date;
  w date;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  today := public._wake_day(uid);
  w := public._welcome_ref(uid, today);
  if w is null or public._back_on_track_days(uid, w, today) < 3 then
    return jsonb_build_object('granted', false);
  end if;
  return jsonb_build_object('granted', public._grant_once(uid, 'back_on_track', w, 2));
end $$;

revoke all on function public._away_run(uuid, date) from public, anon, authenticated;
revoke all on function public._welcome_ref(uuid, date) from public, anon, authenticated;
revoke all on function public._back_on_track_days(uuid, date, date) from public, anon, authenticated;
revoke all on function public.welcome_back_status() from public, anon;
grant execute on function public.welcome_back_status() to authenticated;
revoke all on function public.claim_welcome_back() from public, anon;
grant execute on function public.claim_welcome_back() to authenticated;
revoke all on function public.claim_back_on_track() from public, anon;
grant execute on function public.claim_back_on_track() to authenticated;
