-- G7 (M1/M3 reviewer, for M4), S2: the Night ticket could be claimed the next morning (or at
-- noon for tonight). It now counts only before bed: from 14 h to 1 h before the next planned
-- wake (wake-day p_date + 1). Doing the ritual outside that is still recorded, without a ticket.
create or replace function public.complete_night_ritual(p_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  tz text;
  today date;
  next_wake timestamptz;
  in_time boolean;
  granted boolean := false;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select timezone into tz from public.profiles where user_id = uid;
  today := (now() at time zone coalesce(tz, 'Asia/Bangkok'))::date;
  if p_date not in (today, today - 1) then
    raise exception 'ritual date must be today or yesterday' using errcode = '22023';
  end if;
  next_wake := public._target_wake(uid, p_date + 1);
  in_time := next_wake is not null
    and now() between next_wake - interval '14 hours' and next_wake - interval '1 hour';
  if in_time then
    granted := public._grant_once(uid, 'night', p_date, 1);
  end if;
  insert into public.events (user_id, type, payload)
  values (uid, 'night_ritual_completed',
          jsonb_build_object('date', p_date, 'ticket', granted, 'in_time', in_time));
  return jsonb_build_object('date', p_date, 'ticket_granted', granted, 'in_time', in_time);
end $$;
revoke all on function public.complete_night_ritual(date) from public, anon;
grant execute on function public.complete_night_ritual(date) to authenticated;
