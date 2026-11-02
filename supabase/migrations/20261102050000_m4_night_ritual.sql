-- M4: Night ritual + a tamper-proof ledger for one-off ticket grants.

-- One row per (user, reason, date): a grant can never happen twice, and clients can only read it.
create table public.ticket_grants (
  user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('sunrise', 'night', 'perfect_day', 'weekly_review', 'streak_7', 'streak_14', 'streak_30')),
  ref_date date not null,
  amount integer not null check (amount > 0),
  at timestamptz not null default now(),
  primary key (user_id, reason, ref_date)
);
alter table public.ticket_grants enable row level security;
alter table public.ticket_grants force row level security;
create policy "own rows: select" on public.ticket_grants for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.ticket_grants from anon;

-- Grants `amount` tickets once per (reason, date). Returns true if newly granted.
create or replace function public._grant_once(uid uuid, p_reason text, p_date date, p_amount integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted integer;
begin
  insert into public.ticket_grants (user_id, reason, ref_date, amount)
  values (uid, p_reason, p_date, p_amount)
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return false;
  end if;
  perform public._grant_tickets(uid, p_amount, p_reason, jsonb_build_object('date', p_date));
  return true;
end $$;
revoke all on function public._grant_once(uuid, text, date, integer) from public, anon, authenticated;

-- Sunrise grants also go through the ledger from now on.
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

  if row.id is null then
    select * into row from public.wake_events where user_id = uid and date = d;
    return row;
  end if;

  insert into public.events (user_id, type, payload)
  values (uid, 'wake_pressed', jsonb_build_object('date', d, 'in_window', in_win, 'target', target));
  if in_win then
    perform public._grant_once(uid, 'sunrise', d, 1);
  end if;
  return row;
end $$;

-- "Goodnight": completes the night ritual for wake-day p_date (the day being closed).
-- Only today's or yesterday's local date (no farming tickets for future nights). Night ticket once.
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
  granted boolean;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select timezone into tz from public.profiles where user_id = uid;
  today := (now() at time zone coalesce(tz, 'Asia/Bangkok'))::date;
  if p_date not in (today, today - 1) then
    raise exception 'ritual date must be today or yesterday' using errcode = '22023';
  end if;
  granted := public._grant_once(uid, 'night', p_date, 1);
  insert into public.events (user_id, type, payload)
  values (uid, 'night_ritual_completed', jsonb_build_object('date', p_date, 'ticket', granted));
  return jsonb_build_object('date', p_date, 'ticket_granted', granted);
end $$;
revoke all on function public.complete_night_ritual(date) from public, anon;
grant execute on function public.complete_night_ritual(date) to authenticated;
