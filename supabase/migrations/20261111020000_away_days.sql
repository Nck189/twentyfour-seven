-- Playtest R1 R2 (Minnie OK 2026-11-11): a finished wake-day with nothing logged at all — no
-- wake press, no block log, no Night ritual, no workout — is "away". The farm pauses like a
-- Vacation day: no weeds, no wilt, no death. Mirrors TS `buildDayFacts` (`away`) + `blockResult`.

create or replace function public._away_day(uid uuid, d date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.block_logs where user_id = uid and date = d)
     and not exists (select 1 from public.wake_events where user_id = uid and date = d)
     and not exists (select 1 from public.ticket_grants
                     where user_id = uid and reason = 'night' and ref_date = d)
     and not exists (
       select 1 from public.exercise_logs e
       where e.user_id = uid
         and (e.at at time zone coalesce(
               (select timezone from public.profiles where user_id = uid), 'Asia/Bangkok'))::date = d)
$$;

revoke all on function public._away_day(uuid, date) from public, anon, authenticated;

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
    -- Away (nothing logged that day at all): the farm pauses like Vacation (playtest R1 R2).
    if d < p_today and public._away_day(uid, d) then
      r := 'excused';
    end if;
    -- Lived actions count as the block's on-time start (playtest R1, Minnie 2026-11-11; TS
    -- `credited`): an in-window "I'm up" for Wake, the Night ticket (ritual in time) for Down.
    if r <> 'success' and coalesce(md, 'normal') = 'normal' and not coalesce(lg.miss_reason is not null, false)
       and public._credited(uid, d, p.slot) then
      r := 'success';
    end if;
    -- A planned late night (out late before d + 1, saved before that night) excuses that evening's
    -- Free (G7 R-M6-2, R-M9-1).
    if r in ('miss', 'partial') and p.slot = 'free'
       and public._late_night_planned(uid, d) then
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
