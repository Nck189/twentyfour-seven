-- M3: wake press + check-in integrity.

-- ---------- internal: grant tickets (never callable by clients) ----------
create or replace function public._grant_tickets(uid uuid, amount integer, reason text, meta jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.game_state set tickets = tickets + amount where user_id = uid;
  insert into public.events (user_id, type, payload)
  values (uid, 'ticket_granted', jsonb_build_object('amount', amount, 'reason', reason) || meta);
end $$;
revoke all on function public._grant_tickets(uuid, integer, text, jsonb) from public, anon, authenticated;

-- ---------- target wake for a user's local date ----------
-- Uses the engine snapshot saved with the day plan when present, else the template.
create or replace function public._target_wake(uid uuid, d date)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  tz text;
  plan record;
  tpl record;
  wake_time time;
begin
  select timezone into tz from public.profiles where user_id = uid;
  tz := coalesce(tz, 'Asia/Bangkok');

  select * into plan from public.day_plans where user_id = uid and date = d;
  if found and plan.planned ? 'wake' then
    return (plan.planned ->> 'wake')::timestamptz;
  end if;

  if found and plan.template_id is not null then
    select * into tpl from public.templates where id = plan.template_id and user_id = uid;
  else
    select * into tpl from public.templates
    where user_id = uid and auto_apply and extract(isodow from d)::smallint = any (weekdays)
    order by sort limit 1;
  end if;
  if not found then
    return null;
  end if;

  wake_time := tpl.target_wake;
  if coalesce((tpl.options ->> 'attend_toggle')::boolean, false)
     and plan.attending is not distinct from false
     and tpl.options ? 'alt_target_wake' then
    wake_time := (tpl.options ->> 'alt_target_wake')::time;
  end if;
  return (d + wake_time) at time zone tz;
end $$;
revoke all on function public._target_wake(uuid, date) from public, anon, authenticated;

-- ---------- "I'm up — out of bed" ----------
-- Server clock only (can't be backdated). Within the window (default 15 min after target,
-- up to 3 h early) → Sunrise ticket, once per day. Pressing again returns the first press.
create or replace function public.press_wake()
returns public.wake_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  tz text;
  d date;
  target timestamptz;
  window_min integer;
  in_win boolean;
  row public.wake_events;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select timezone into tz from public.profiles where user_id = uid;
  d := (now() at time zone coalesce(tz, 'Asia/Bangkok'))::date;

  select * into row from public.wake_events where user_id = uid and date = d;
  if found then
    return row;
  end if;

  target := public._target_wake(uid, d);
  select wake_window_min into window_min from public.settings where user_id = uid;
  window_min := coalesce(window_min, 15);
  in_win := target is not null
    and now() <= target + make_interval(mins => window_min)
    and now() >= target - interval '3 hours';

  insert into public.wake_events (user_id, date, target_wake, pressed_at, in_window, backfilled)
  values (uid, d, coalesce(target, now()), now(), in_win, false)
  on conflict (user_id, date) do nothing
  returning * into row;

  if row.id is null then -- lost a race with a concurrent press
    select * into row from public.wake_events where user_id = uid and date = d;
    return row;
  end if;

  insert into public.events (user_id, type, payload)
  values (uid, 'wake_pressed', jsonb_build_object('date', d, 'in_window', in_win, 'target', target));
  if in_win then
    perform public._grant_tickets(uid, 1, 'sunrise', jsonb_build_object('date', d));
  end if;
  return row;
end $$;
revoke all on function public.press_wake() from public, anon;
grant execute on function public.press_wake() to authenticated;

-- ---------- backfill a missed "I'm up" (counts for %, no ticket) ----------
create or replace function public.backfill_wake(p_date date, p_pressed_at timestamptz)
returns public.wake_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  target timestamptz;
  window_min integer;
  row public.wake_events;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_pressed_at > now() then
    raise exception 'cannot backfill the future' using errcode = '22023';
  end if;
  target := public._target_wake(uid, p_date);
  select wake_window_min into window_min from public.settings where user_id = uid;
  insert into public.wake_events (user_id, date, target_wake, pressed_at, in_window, backfilled)
  values (
    uid, p_date, coalesce(target, p_pressed_at), p_pressed_at,
    target is not null and p_pressed_at <= target + make_interval(mins => coalesce(window_min, 15))
      and p_pressed_at >= target - interval '3 hours',
    true
  )
  on conflict (user_id, date) do nothing
  returning * into row;
  if row.id is null then
    select * into row from public.wake_events where user_id = uid and date = p_date;
  else
    insert into public.events (user_id, type, payload)
    values (uid, 'wake_backfilled', jsonb_build_object('date', p_date, 'pressed_at', p_pressed_at));
  end if;
  return row;
end $$;
revoke all on function public.backfill_wake(date, timestamptz) from public, anon;
grant execute on function public.backfill_wake(date, timestamptz) to authenticated;

-- Clients can no longer insert wake events directly (only through the RPCs above).
drop policy if exists "own rows: insert" on public.wake_events;
drop policy if exists "own rows: update" on public.wake_events;

-- ---------- block logs: real timestamps, server-enforced backfill flag ----------
-- Any timestamp set more than 10 min away from the server clock marks the log backfilled,
-- and a backfilled log can never become "live" again.
create or replace function public.block_logs_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  grace interval := interval '10 minutes';
  is_backfill boolean := false;
begin
  if tg_op = 'UPDATE' and old.backfilled then
    new.backfilled := true;
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

create trigger block_logs_guard
  before insert or update on public.block_logs
  for each row execute function public.block_logs_guard();
