-- A wake-day runs wake → next wake, so its blocks can start up to 48 h after its own midnight
-- (a 23:59 wake + 24 h). The M9 guard allowed 36 h, so a late riser's Sleep started at Goodnight
-- read as a backfill (CI caught it in the afternoon, Bangkok). Same function, wider window.
create or replace function public.block_logs_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  grace interval := interval '10 minutes';
  is_backfill boolean := false;
  tz text;
  today date;
  day_start timestamptz;
begin
  -- Admin (service role) may write logs as they are, e.g. to set up a past week in a test.
  if current_user = 'service_role' or current_setting('role', true) = 'service_role' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.backfilled then
    new.backfilled := true;
  end if;
  select timezone into tz from public.profiles where user_id = new.user_id;
  tz := coalesce(tz, 'Asia/Bangkok');
  today := (now() at time zone tz)::date;
  -- G7 R-M6-1: no check-ins for a day that hasn't come (they'd count as live when it does).
  if new.date > today then
    raise exception 'a check-in can''t be for a future day' using errcode = '22023';
  end if;
  if new.date < today - 1 then
    is_backfill := true;
  end if;
  if new.date < public._wake_day(new.user_id)
     and (tg_op = 'INSERT'
          or new.started_at is distinct from old.started_at
          or new.first10_at is distinct from old.first10_at
          or new.planned_start is distinct from old.planned_start) then
    is_backfill := true;
  end if;
  day_start := new.date::timestamp at time zone tz;
  if new.planned_start is not null
     and (tg_op = 'INSERT' or new.planned_start is distinct from old.planned_start)
     and new.planned_start not between day_start - interval '6 hours' and day_start + interval '48 hours' then
    is_backfill := true;
  end if;
  if new.started_at is not null and (tg_op = 'INSERT' or new.started_at is distinct from old.started_at)
     and abs(extract(epoch from (now() - new.started_at))) > extract(epoch from grace) then
    is_backfill := true;
  end if;
  if new.first10_at is not null and (tg_op = 'INSERT' or new.first10_at is distinct from old.first10_at)
     and abs(extract(epoch from (now() - new.first10_at))) > extract(epoch from grace) then
    is_backfill := true;
  end if;
  if new.closed_at is not null and (tg_op = 'INSERT' or new.closed_at is distinct from old.closed_at)
     and abs(extract(epoch from (now() - new.closed_at))) > extract(epoch from grace) then
    is_backfill := true;
  end if;
  if is_backfill then
    new.backfilled := true;
  end if;
  return new;
end $$;
revoke all on function public.block_logs_guard() from public, anon, authenticated;
