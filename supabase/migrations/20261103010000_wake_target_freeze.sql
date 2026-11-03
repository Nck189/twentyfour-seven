-- G7 re-review R-M3-1, R-M3-2, R-M4-1 (S1) and R-M1-4.
--
-- The Sunrise target for wake-day D:
--   * follows a planned push (bedtime later, out late): the engine's wake time is saved with the
--     day plan as planned = {wake, base}. It counts if it was planned at least 4 h before that
--     wake, from the current template target (base; a template change makes it stale), and within
--     sane bounds of that target.
--   * otherwise the template target (as before).
--   * is frozen once it's close: an edit made within 4 h of the old OR the new target (templates,
--     the day plan, the wake window, the timezone) first keeps the old target in wake_snapshots,
--     and "I'm up" uses the snapshot. So moving the target to "now" after oversleeping, or
--     widening the window, never opens the window.

create table public.wake_snapshots (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  target_wake timestamptz not null,
  window_min smallint not null,
  created_at timestamptz not null default now(),
  primary key (user_id, date)
);
alter table public.wake_snapshots enable row level security;
create policy "own rows: select" on public.wake_snapshots
  for select to authenticated using (user_id = (select auth.uid()));
-- No insert/update/delete policies: only the security-definer functions below write it.

-- When planned.wake was last set (server time; whatever a client sends is ignored).
alter table public.day_plans add column wake_planned_at timestamptz;

create or replace function public._stamp_wake_planned()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Admin (service role) may set it directly, e.g. to set up a test.
  if current_user = 'service_role' and new.wake_planned_at is not null then
    return new;
  end if;
  if tg_op = 'INSERT' or (new.planned ->> 'wake') is distinct from (old.planned ->> 'wake') then
    new.wake_planned_at := case when (new.planned ->> 'wake') is not null then now() end;
  else
    new.wake_planned_at := old.wake_planned_at;
  end if;
  return new;
end $$;

create trigger stamp_wake_planned before insert or update on public.day_plans
  for each row execute function public._stamp_wake_planned();

-- Live target for (uid, d): template (+ attending), or a valid planned push.
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
  base timestamptz;
  pw timestamptz;
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
  base := (d + wake_time) at time zone tz;

  begin
    pw := (plan.planned ->> 'wake')::timestamptz;
    if (plan.planned ->> 'base')::timestamptz is distinct from base then
      pw := null; -- planned from another template target: stale
    end if;
  exception when others then
    pw := null;
  end;
  if pw is not null
     and plan.wake_planned_at is not null
     and plan.wake_planned_at <= pw - interval '4 hours'
     and pw between base - interval '6 hours' and base + interval '8 hours' then
    return pw;
  end if;
  return base;
end $$;

-- Wake-days an edit by uid can move: today and yesterday (local), plus a day plan's own date.
create or replace function public._wake_days(uid uuid, extra date default null)
returns date[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_remove(array[
    (now() at time zone coalesce((select timezone from public.profiles where user_id = uid), 'Asia/Bangkok'))::date,
    (now() at time zone coalesce((select timezone from public.profiles where user_id = uid), 'Asia/Bangkok'))::date - 1,
    extra
  ], null);
$$;

-- BEFORE an edit: remember each day's current target (once per transaction); freeze it now if the
-- edit comes within 4 h of it.
create or replace function public._wake_before(uid uuid, days date[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d date;
  old timestamptz;
  k text;
begin
  if uid is null then
    return;
  end if;
  foreach d in array days loop
    if exists (select 1 from public.wake_events where user_id = uid and date = d)
       or exists (select 1 from public.wake_snapshots where user_id = uid and date = d) then
      continue;
    end if;
    old := public._target_wake(uid, d);
    if old is null then
      continue;
    end if;
    if now() >= old - interval '4 hours' then
      insert into public.wake_snapshots (user_id, date, target_wake, window_min)
      values (uid, d, old,
              coalesce((select wake_window_min from public.settings where user_id = uid), 15))
      on conflict do nothing;
      continue;
    end if;
    k := 'wake.old_' || to_char(d, 'YYYYMMDD');
    if nullif(current_setting(k, true), '') is null then
      perform set_config(k, old::text, true);
    end if;
  end loop;
end $$;

-- AFTER an edit: if it moved a day's target to within 4 h of now (or earlier), keep the old one.
create or replace function public._wake_after(uid uuid, days date[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d date;
  old timestamptz;
  nw timestamptz;
begin
  if uid is null then
    return;
  end if;
  foreach d in array days loop
    old := nullif(current_setting('wake.old_' || to_char(d, 'YYYYMMDD'), true), '')::timestamptz;
    if old is null
       or exists (select 1 from public.wake_events where user_id = uid and date = d)
       or exists (select 1 from public.wake_snapshots where user_id = uid and date = d) then
      continue;
    end if;
    nw := public._target_wake(uid, d);
    if nw is null or now() >= nw - interval '4 hours' then
      insert into public.wake_snapshots (user_id, date, target_wake, window_min)
      values (uid, d, old,
              coalesce((select wake_window_min from public.settings where user_id = uid), 15))
      on conflict do nothing;
    end if;
  end loop;
end $$;

-- Day plans: the plan's own date, plus today/yesterday.
create or replace function public._wake_guard_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := coalesce(new.user_id, old.user_id);
  day date := coalesce(new.date, old.date);
begin
  if tg_when = 'BEFORE' then
    perform public._wake_before(uid, public._wake_days(uid, day));
    return coalesce(new, old);
  end if;
  perform public._wake_after(uid, public._wake_days(uid, day));
  return null;
end $$;

-- Templates, settings (wake window), profiles (timezone): today/yesterday.
create or replace function public._wake_guard_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := coalesce(new.user_id, old.user_id);
begin
  if tg_when = 'BEFORE' then
    perform public._wake_before(uid, public._wake_days(uid));
    return coalesce(new, old);
  end if;
  perform public._wake_after(uid, public._wake_days(uid));
  return null;
end $$;

create trigger wake_guard_before before insert or update or delete on public.day_plans
  for each row execute function public._wake_guard_day();
create trigger wake_guard_after after insert or update or delete on public.day_plans
  for each row execute function public._wake_guard_day();
create trigger wake_guard_before before insert or update or delete on public.templates
  for each row execute function public._wake_guard_user();
create trigger wake_guard_after after insert or update or delete on public.templates
  for each row execute function public._wake_guard_user();
-- A wider window only matters near the target: freeze then (the snapshot keeps the old window).
create trigger wake_guard_before before update of wake_window_min on public.settings
  for each row execute function public._wake_guard_user();
create trigger wake_guard_before before update of timezone on public.profiles
  for each row execute function public._wake_guard_user();
create trigger wake_guard_after after update of timezone on public.profiles
  for each row execute function public._wake_guard_user();

-- "I'm up": a frozen day uses its snapshot (target + window).
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
  snap public.wake_snapshots;
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

  select * into snap from public.wake_snapshots where user_id = uid and date = d;
  if found then
    target := snap.target_wake;
    window_min := snap.window_min;
  else
    target := public._target_wake(uid, d);
    select wake_window_min into window_min from public.settings where user_id = uid;
    window_min := coalesce(window_min, 15);
  end if;
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

-- R-M1-4: wake history is immutable for clients (insert/update were already RPC-only).
drop policy if exists "own rows: delete" on public.wake_events;

revoke execute on function public._target_wake(uuid, date) from public, anon, authenticated;
revoke execute on function public._wake_days(uuid, date) from public, anon, authenticated;
revoke execute on function public._wake_before(uuid, date[]) from public, anon, authenticated;
revoke execute on function public._wake_after(uuid, date[]) from public, anon, authenticated;
