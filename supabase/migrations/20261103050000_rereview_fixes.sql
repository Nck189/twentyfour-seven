-- G7 re-review 2026-11-03 (docs/qa/G7-rereview-2026-11-03.md).

-- R2-1 (S1): the freeze also checks tomorrow (an edit at 23:55 setting a 00:30 wake).
create or replace function public._wake_days(uid uuid, extra date default null)
returns date[]
language sql
stable
security definer
set search_path = ''
as $$
  with t as (
    select (now() at time zone coalesce(
      (select timezone from public.profiles where user_id = uid), 'Asia/Bangkok'))::date as d
  )
  select array_remove(array[(select d - 1 from t), (select d from t), (select d + 1 from t), extra], null);
$$;

-- R2-4: the server picks the same kind of day as the app when a weekday has none (first kind,
-- then any); a planned push counts within −2 h / +8 h of it (R2-3: no pulling the target hours
-- earlier), no longer only when planned from the exact same template target.
create or replace function public._target_wake(uid uuid, d date)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  tz text;
  plan public.day_plans;
  tpl public.templates;
  wake_time time;
  base timestamptz;
  pw timestamptz;
begin
  select timezone into tz from public.profiles where user_id = uid;
  tz := coalesce(tz, 'Asia/Bangkok');
  select * into plan from public.day_plans where user_id = uid and date = d;
  if plan.template_id is not null then
    select * into tpl from public.templates where id = plan.template_id and user_id = uid;
  end if;
  if tpl.id is null then
    select * into tpl from public.templates
    where user_id = uid and auto_apply and extract(isodow from d)::smallint = any (weekdays)
    order by sort limit 1;
  end if;
  if tpl.id is null then
    select * into tpl from public.templates where user_id = uid
    order by auto_apply desc, sort limit 1;
  end if;
  if tpl.id is null then
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
  exception when others then
    pw := null;
  end;
  if pw is not null
     and plan.wake_planned_at is not null
     and plan.wake_planned_at <= pw - interval '4 hours'
     and pw between base - interval '2 hours' and base + interval '8 hours' then
    return pw;
  end if;
  return base;
end $$;

-- Freeze helpers: skip users being deleted (account deletion cascades through these tables);
-- a change that leaves a day without any target doesn't freeze (it earns nothing anyway).
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
  if uid is null or not exists (select 1 from auth.users where id = uid) then
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
  if uid is null or not exists (select 1 from auth.users where id = uid) then
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
    if nw is not null and now() >= nw - interval '4 hours' then
      insert into public.wake_snapshots (user_id, date, target_wake, window_min)
      values (uid, d, old,
              coalesce((select wake_window_min from public.settings where user_id = uid), 15))
      on conflict do nothing;
    end if;
  end loop;
end $$;

-- R2-2 (S1): profiles and settings rows are created at sign-up and only updated by the app;
-- deleting + re-inserting them bypassed the freeze. The wake window is 5–30 min (SPEC: 15).
drop policy if exists "own rows: insert" on public.profiles;
drop policy if exists "own rows: delete" on public.profiles;
drop policy if exists "own rows: insert" on public.settings;
drop policy if exists "own rows: delete" on public.settings;
update public.settings set wake_window_min = least(greatest(wake_window_min, 5), 30)
  where wake_window_min not between 5 and 30;
alter table public.settings drop constraint if exists settings_wake_window_min_check;
alter table public.settings add constraint settings_wake_window_min_check
  check (wake_window_min between 5 and 30);

-- R2-7: the daily coin cap holds under parallel calls (one completion at a time per user).
create or replace function public.complete_backlog_item(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  item public.backlog_items;
  amount integer;
  inserted integer;
  tz text;
  day_start timestamptz;
  earned_today integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  perform 1 from public.game_state where user_id = uid for update;
  select * into item from public.backlog_items where id = p_id and user_id = uid for update;
  if not found then
    raise exception 'backlog item not found' using errcode = 'P0002';
  end if;
  if item.status = 'dropped' then
    return jsonb_build_object('coins_granted', 0);
  end if;
  update public.backlog_items
     set status = 'done', done_at = coalesce(done_at, now())
   where id = p_id;

  amount := case item.priority when 'must' then 30 when 'should' then 20 else 10 end;
  if now() - item.created_at < interval '10 minutes'
     or now() - item.priority_set_at < interval '10 minutes' then
    amount := least(amount, 10);
  end if;

  select timezone into tz from public.profiles where user_id = uid;
  day_start := ((now() at time zone coalesce(tz, 'Asia/Bangkok'))::date)::timestamp
               at time zone coalesce(tz, 'Asia/Bangkok');
  select coalesce(sum(g.amount), 0) into earned_today
    from public.coin_grants g
   where g.user_id = uid and g.reason = 'backlog_done' and g.at >= day_start;
  amount := least(amount, greatest(0, 150 - earned_today));
  if amount <= 0 then
    return jsonb_build_object('coins_granted', 0, 'capped', true);
  end if;

  insert into public.coin_grants (user_id, reason, ref, amount)
  values (uid, 'backlog_done', p_id::text, amount)
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return jsonb_build_object('coins_granted', 0);
  end if;

  update public.game_state set coins = coins + amount where user_id = uid;
  insert into public.events (user_id, type, payload)
  values (uid, 'coins_granted', jsonb_build_object('amount', amount, 'reason', 'backlog_done', 'item', p_id));
  return jsonb_build_object('coins_granted', amount);
end $$;
revoke all on function public.complete_backlog_item(uuid) from public, anon;
grant execute on function public.complete_backlog_item(uuid) to authenticated;

-- R2-8: the Night ticket counts from 14 h to 5 h before the next wake (frozen target if any),
-- and not once "I'm up" was pressed for that morning.
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
  next_wake := coalesce(
    (select target_wake from public.wake_snapshots where user_id = uid and date = p_date + 1),
    public._target_wake(uid, p_date + 1));
  in_time := next_wake is not null
    and now() between next_wake - interval '14 hours' and next_wake - interval '5 hours'
    and not exists (select 1 from public.wake_events where user_id = uid and date = p_date + 1);
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

-- R2-5: appointments are added/removed one by one (a stale device can't wipe another's list).
drop function if exists public.patch_day_plan(date, jsonb, jsonb, jsonb);
create or replace function public.patch_day_plan(
  p_date date,
  p_set jsonb default '{}'::jsonb,
  p_blocks jsonb default null,
  p_add_events jsonb default null,
  p_remove_event_ids text[] default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  s jsonb := coalesce(p_set, '{}'::jsonb);
  events jsonb;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if s ? 'template_id' and (s ->> 'template_id') is not null
     and not exists (select 1 from public.templates where id = (s ->> 'template_id')::uuid and user_id = uid) then
    raise exception 'template not found' using errcode = 'P0002';
  end if;
  insert into public.day_plans (user_id, date) values (uid, p_date)
  on conflict (user_id, date) do nothing;
  select coalesce(overrides -> 'fixed_events', '[]'::jsonb) into events
    from public.day_plans where user_id = uid and date = p_date for update;
  if p_remove_event_ids is not null then
    select coalesce(jsonb_agg(e), '[]'::jsonb) into events
      from jsonb_array_elements(events) e
     where not ((e ->> 'id') = any (p_remove_event_ids));
  end if;
  if p_add_events is not null then
    select events || coalesce(jsonb_agg(a), '[]'::jsonb) into events
      from jsonb_array_elements(p_add_events) a
     where not exists (select 1 from jsonb_array_elements(events) e where e ->> 'id' = a ->> 'id');
  end if;
  update public.day_plans d set
    template_id = case when s ? 'template_id' then (s ->> 'template_id')::uuid else d.template_id end,
    attending = case when s ? 'attending' then (s ->> 'attending')::boolean else d.attending end,
    bedtime_override = case when s ? 'bedtime_override'
                            then (s ->> 'bedtime_override')::timestamptz else d.bedtime_override end,
    late_night = case when s ? 'late_night'
                      then nullif(s -> 'late_night', 'null'::jsonb) else d.late_night end,
    mode = case when s ? 'mode' then s ->> 'mode' else d.mode end,
    planned = case when s ? 'planned' then nullif(s -> 'planned', 'null'::jsonb) else d.planned end,
    overrides = d.overrides
      || case when p_blocks is not null
              then jsonb_build_object('blocks', coalesce(d.overrides -> 'blocks', '{}'::jsonb) || p_blocks)
              else '{}'::jsonb end
      || case when p_add_events is not null or p_remove_event_ids is not null
              then jsonb_build_object('fixed_events', events)
              else '{}'::jsonb end
  where d.user_id = uid and d.date = p_date;
end $$;
revoke all on function public.patch_day_plan(date, jsonb, jsonb, jsonb, text[]) from public, anon;
grant execute on function public.patch_day_plan(date, jsonb, jsonb, jsonb, text[]) to authenticated;
