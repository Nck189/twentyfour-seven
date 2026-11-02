-- Fixes from the M1–M3 independent review.

-- M3-F1: the Sunrise window comes from the template (+ day's template choice / attending),
-- never from the client-written `planned` snapshot.
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
  if found and plan.template_id is not null then
    select * into tpl from public.templates where id = plan.template_id and user_id = uid;
  else
    select * into tpl from public.templates
    where user_id = uid and auto_apply and extract(isodow from d)::smallint = any (weekdays)
    order by sort limit 1;
  end if;
  if tpl is null or tpl.id is null then
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

-- M1-F1: plots change only through server functions (planting/harvest arrive with the farm).
drop policy if exists "own rows: insert" on public.plots;
drop policy if exists "own rows: update" on public.plots;
drop policy if exists "own rows: delete" on public.plots;

-- M1-F3: server-only event types can't be inserted by clients (events are the audit log).
drop policy if exists "own rows: insert" on public.events;
create policy "own rows: insert" on public.events for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and type not in ('ticket_granted', 'wake_pressed', 'wake_backfilled', 'night_ritual_completed',
                     'gacha_pull', 'coins_granted', 'essence_granted', 'egg_hatched', 'harvest')
  );

-- M3-F4: backfill only for past dates, at most 30 days back.
create or replace function public.backfill_wake(p_date date, p_pressed_at timestamptz)
returns public.wake_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  tz text;
  today date;
  target timestamptz;
  window_min integer;
  row public.wake_events;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select timezone into tz from public.profiles where user_id = uid;
  today := (now() at time zone coalesce(tz, 'Asia/Bangkok'))::date;
  if p_date >= today or p_date < today - 30 then
    raise exception 'backfill is only for the past 30 days' using errcode = '22023';
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

-- M3-F8: logs for dates more than a day in the past are always backfilled.
create or replace function public.block_logs_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  grace interval := interval '10 minutes';
  is_backfill boolean := false;
  tz text;
  today date;
begin
  if tg_op = 'UPDATE' and old.backfilled then
    new.backfilled := true;
  end if;
  select timezone into tz from public.profiles where user_id = new.user_id;
  today := (now() at time zone coalesce(tz, 'Asia/Bangkok'))::date;
  if new.date < today - 1 then
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
