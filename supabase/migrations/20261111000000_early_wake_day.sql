-- Playtest R1 P2: "I'm up" pressed before the target starts the wake-day at the press.
-- Before, the day began only at the target, so for those minutes Today, the streak and the
-- farm sky stayed on yesterday ("23:00 ไปนอน" at breakfast). A wake event for today's date
-- exists only once the person has said they're up (press or backfill), so it marks the start.
create or replace function public._wake_day(uid uuid)
returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  tz text;
  d date;
  w timestamptz;
begin
  select timezone into tz from public.profiles where user_id = uid;
  d := (now() at time zone coalesce(tz, 'Asia/Bangkok'))::date;
  if exists (select 1 from public.wake_events where user_id = uid and date = d) then
    return d;
  end if;
  w := coalesce(
    (select target_wake from public.wake_snapshots where user_id = uid and date = d),
    public._target_wake(uid, d));
  if w is not null and now() < w then
    return d - 1;
  end if;
  return d;
end $$;
revoke all on function public._wake_day(uuid) from public, anon, authenticated;
