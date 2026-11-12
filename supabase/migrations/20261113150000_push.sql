-- M11 push notifications (SPEC §9). Web Push with VAPID; permission only after a user tap.
-- Today plans the day's reminders (lib/push/schedule.ts, with text in the user's language) and
-- uploads them with set_push_schedule. Every minute pg_cron asks the sender (an Edge Function)
-- to deliver what push_due() returns: due now, still wanted, and still relevant (a block that
-- already started, an "I'm up" already pressed, a Night ritual already done are skipped).

-- Per-type switches and quiet hours (More → Notifications). Column grants like the rest of profiles.
alter table public.profiles
  add column if not exists push_block_start boolean not null default true,
  add column if not exists push_first10 boolean not null default true,
  add column if not exists push_wake boolean not null default true,
  add column if not exists push_night boolean not null default true,
  add column if not exists push_quiet_start text check (push_quiet_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  add column if not exists push_quiet_end text check (push_quiet_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
grant update (push_block_start, push_first10, push_wake, push_night, push_quiet_start, push_quiet_end)
  on public.profiles to authenticated;

create table public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;
create policy "own rows: select" on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own rows: delete" on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;

create table public.push_schedule (
  user_id uuid not null references auth.users (id) on delete cascade,
  ref text not null check (char_length(ref) <= 80),
  kind text not null check (kind in ('block_start', 'first10', 'wake', 'night')),
  day date not null,
  block text check (block in ('down', 'sleep', 'wake', 'focus', 'work', 'gradation', 'free')),
  fire_at timestamptz not null,
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) <= 200),
  sent_at timestamptz,
  primary key (user_id, ref)
);
create index push_schedule_due on public.push_schedule (fire_at) where sent_at is null;
alter table public.push_schedule enable row level security;
alter table public.push_schedule force row level security;
create policy "own rows: select" on public.push_schedule for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.push_schedule from anon, authenticated;
grant select on public.push_schedule to authenticated;

-- Server-written events only (adds push_subscribed).
drop policy if exists "own rows: insert" on public.events;
create policy "own rows: insert" on public.events for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and type not in ('ticket_granted', 'wake_pressed', 'wake_backfilled', 'night_ritual_completed',
                     'gacha_pull', 'coins_granted', 'essence_granted', 'egg_hatched', 'harvest',
                     'seed_planted', 'decor_bought', 'star_up', 'unlock_granted',
                     'exercise_logged', 'animal_petted', 'produce_collected', 'animal_fed',
                     'days_settled', 'weekly_review_done',
                     'produce_sold', 'seed_bought', 'ticket_exchanged', 'upgrade_bought',
                     'order_delivered', 'reward_redeemed',
                     'seasonal_order_delivered', 'wish_floated', 'story_seen',
                     'cafe_order', 'cafe_card', 'coffee_answered', 'coffee_cup_added',
                     'push_subscribed')
  );

-- Save this device's subscription (after the user tapped "Turn on"). One endpoint belongs to one
-- account: signing in as someone else on the same device moves it.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id <> uid;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (uid, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth;
  insert into public.events (user_id, type, payload) values (uid, 'push_subscribed', '{}'::jsonb);
end $$;

-- Replace this user's upcoming (unsent) reminders with the plan from Today. Validated: at most 24,
-- known kinds, within the next 36 h.
create or replace function public.set_push_schedule(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  n integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 24 then
    raise exception 'at most 24 reminders' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_items) i
             where (i ->> 'fire_at')::timestamptz <= now()
                or (i ->> 'fire_at')::timestamptz > now() + interval '36 hours') then
    raise exception 'reminders must be within the next 36 hours' using errcode = '22023';
  end if;
  delete from public.push_schedule where user_id = uid and sent_at is null and fire_at > now();
  insert into public.push_schedule (user_id, ref, kind, day, block, fire_at, title, body)
  select uid, i ->> 'ref', i ->> 'kind', (i ->> 'day')::date, i ->> 'block',
         (i ->> 'fire_at')::timestamptz, i ->> 'title', coalesce(i ->> 'body', '')
  from jsonb_array_elements(p_items) i
  on conflict (user_id, ref) do update
    set kind = excluded.kind, day = excluded.day, block = excluded.block, fire_at = excluded.fire_at,
        title = excluded.title, body = excluded.body
    where public.push_schedule.sent_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

-- For the sender (service role only): reminders due in the last 15 min that are still wanted and
-- still relevant, one row per device.
create or replace function public.push_due(p_limit integer default 500)
returns table (user_id uuid, ref text, title text, body text, endpoint text, p256dh text, auth text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.user_id, s.ref, s.title, s.body, d.endpoint, d.p256dh, d.auth
  from public.push_schedule s
  join public.profiles p on p.user_id = s.user_id
  join public.push_subscriptions d on d.user_id = s.user_id
  where s.sent_at is null
    and s.fire_at <= now() and s.fire_at > now() - interval '15 minutes'
    and case s.kind
          when 'block_start' then p.push_block_start
          when 'first10' then p.push_first10
                              and not exists (select 1 from public.block_logs l
                                              where l.user_id = s.user_id and l.date = s.day
                                                and l.block = s.block and l.started_at is not null)
          when 'wake' then p.push_wake
                           and not exists (select 1 from public.wake_events w
                                           where w.user_id = s.user_id and w.date = s.day)
          when 'night' then p.push_night
                            and not exists (select 1 from public.events e
                                            where e.user_id = s.user_id
                                              and e.type = 'night_ritual_completed'
                                              and e.payload ->> 'date' = s.day::text)
          else false
        end
  order by s.fire_at
  limit p_limit
$$;

-- After sending (service role only). Missed or skipped ones are marked too, so they never resend.
create or replace function public.push_mark_sent(p_user uuid, p_ref text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.push_schedule set sent_at = now() where user_id = p_user and ref = p_ref
$$;

-- A push service said the device is gone (404/410): drop it (service role only).
create or replace function public.push_drop_endpoint(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint
$$;

revoke all on function public.save_push_subscription(text, text, text) from public, anon;
revoke all on function public.set_push_schedule(jsonb) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
grant execute on function public.set_push_schedule(jsonb) to authenticated;
revoke all on function public.push_due(integer) from public, anon, authenticated;
revoke all on function public.push_mark_sent(uuid, text) from public, anon, authenticated;
revoke all on function public.push_drop_endpoint(text) from public, anon, authenticated;
grant execute on function public.push_due(integer) to service_role;
grant execute on function public.push_mark_sent(uuid, text) to service_role;
grant execute on function public.push_drop_endpoint(text) to service_role;
