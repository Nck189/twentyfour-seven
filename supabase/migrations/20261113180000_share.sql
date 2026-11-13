-- M12 share availability + booking (SPEC §9). A secret link per user shows free/busy only for the
-- next 14 days (computed on the server from the engine inputs `share_context` returns: no titles,
-- tasks, first-10s or checklists). Anyone with the link can ask for a slot (name + note) through a
-- rate-limited RPC; the owner accepts or declines, and an accepted request becomes a fixed event
-- in that day's plan (the engine re-flows the day). Anonymous access only through these
-- token-checked RPCs.

create table public.share_links (
  user_id uuid primary key references auth.users (id) on delete cascade,
  token text not null unique check (token ~ '^[0-9a-f]{48}$'),
  scope text not null default 'freebusy' check (scope in ('freebusy')),
  created_at timestamptz not null default now()
);
alter table public.share_links enable row level security;
alter table public.share_links force row level security;
create policy "own rows: select" on public.share_links for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.share_links from anon, authenticated;
grant select on public.share_links to authenticated;

create table public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  name text not null check (char_length(name) between 1 and 60),
  note text not null default '' check (char_length(note) <= 300),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  check (end_at > start_at)
);
create index booking_requests_owner on public.booking_requests (user_id, created_at);
alter table public.booking_requests enable row level security;
alter table public.booking_requests force row level security;
create policy "own rows: select" on public.booking_requests for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.booking_requests from anon, authenticated;
grant select on public.booking_requests to authenticated;

-- Server-written events only (adds the share/booking ones).
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
                     'push_subscribed', 'ics_link_made',
                     'share_link_made', 'booking_requested', 'booking_answered')
  );

-- The user's own link (made on first use; p_rotate = a new one, the old one stops working).
create or replace function public.share_link(p_rotate boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  tok text;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select s.token into tok from public.share_links s where s.user_id = uid;
  if tok is null or p_rotate then
    tok := encode(extensions.gen_random_bytes(24), 'hex');
    insert into public.share_links (user_id, token) values (uid, tok)
    on conflict (user_id) do update set token = excluded.token, created_at = now();
    insert into public.events (user_id, type, payload)
    values (uid, 'share_link_made', jsonb_build_object('rotated', p_rotate));
  end if;
  return tok;
end $$;

-- A blocks map/list without labels the public must not see (checklists, first-10s).
create or replace function public._share_blocks(p jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p) = 'object' then
      coalesce((select jsonb_object_agg(k, case when jsonb_typeof(v) = 'object' then v - 'checklist' - 'first10' else v end)
                from jsonb_each(p) e(k, v)), '{}'::jsonb)
    when jsonb_typeof(p) = 'array' then
      coalesce((select jsonb_agg(case when jsonb_typeof(v) = 'object' then v - 'checklist' - 'first10' else v end)
                from jsonb_array_elements(p) v), '[]'::jsonb)
    else p end
$$;

-- Fixed events without their titles (busy is busy).
create or replace function public._share_events(p jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(p) = 'array' then
    coalesce((select jsonb_agg(case when jsonb_typeof(v) = 'object' then v - 'title' else v end)
              from jsonb_array_elements(p) v), '[]'::jsonb)
  else p end
$$;

-- The engine inputs for a valid link only (null otherwise): no titles, tasks, first-10s, checklists.
create or replace function public.share_context(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid;
  tz text;
  loc text;
  who text;
  today date;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{48}$' then
    return null;
  end if;
  select s.user_id into uid from public.share_links s where s.token = p_token;
  if uid is null then
    return null;
  end if;
  select p.timezone, p.locale, p.display_name into tz, loc, who from public.profiles p where p.user_id = uid;
  today := (now() at time zone coalesce(tz, 'Asia/Bangkok'))::date;
  return jsonb_build_object(
    'timezone', coalesce(tz, 'Asia/Bangkok'),
    'locale', coalesce(loc, 'en'),
    'name', nullif(btrim(coalesce(who, '')), ''),
    'settings', (select jsonb_build_object('blocks', public._share_blocks(s.blocks), 'gym_close_time', s.gym_close_time)
                 from public.settings s where s.user_id = uid),
    'templates', coalesce((select jsonb_agg(
                             jsonb_set(jsonb_set(to_jsonb(t) - 'user_id' - 'name', '{blocks}', public._share_blocks(t.blocks)),
                                       '{fixed_events}', public._share_events(t.fixed_events))
                             order by t.sort)
                           from public.templates t where t.user_id = uid), '[]'::jsonb),
    'day_plans', coalesce((select jsonb_agg(jsonb_build_object(
                             'date', d.date, 'template_id', d.template_id, 'attending', d.attending,
                             'bedtime_override', d.bedtime_override, 'late_night', d.late_night,
                             'mode', d.mode,
                             'overrides', d.overrides
                               || case when jsonb_typeof(d.overrides -> 'blocks') = 'object'
                                       then jsonb_build_object('blocks', public._share_blocks(d.overrides -> 'blocks'))
                                       else '{}'::jsonb end
                               || case when jsonb_typeof(d.overrides -> 'fixed_events') = 'array'
                                       then jsonb_build_object('fixed_events', public._share_events(d.overrides -> 'fixed_events'))
                                       else '{}'::jsonb end))
                           from public.day_plans d
                           where d.user_id = uid and d.date between today - 2 and today + 15), '[]'::jsonb)
  );
end $$;

-- Ask for a slot through a link (no account). Validated and rate-limited per link owner: at most 5
-- an hour and 20 a day; 15 min to 4 h, from now to 15 days ahead, inside one local calendar day.
create or replace function public.request_slot(
  p_token text, p_day date, p_start timestamptz, p_end timestamptz, p_name text, p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  tz text;
  nm text := btrim(coalesce(p_name, ''));
  nt text := btrim(coalesce(p_note, ''));
  rid uuid;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{48}$' then
    raise exception 'link not found' using errcode = 'P0002';
  end if;
  select s.user_id into uid from public.share_links s where s.token = p_token;
  if uid is null then
    raise exception 'link not found' using errcode = 'P0002';
  end if;
  tz := coalesce((select p.timezone from public.profiles p where p.user_id = uid), 'Asia/Bangkok');
  if char_length(nm) < 1 or char_length(nm) > 60 or char_length(nt) > 300 then
    raise exception 'a name (up to 60) and a short note (up to 300)' using errcode = '22023';
  end if;
  if p_start is null or p_end is null or p_end <= p_start
     or p_end - p_start < interval '15 minutes' or p_end - p_start > interval '4 hours'
     or p_start < now() or p_end > now() + interval '15 days'
     or (p_start at time zone tz)::date <> ((p_end - interval '1 second') at time zone tz)::date
     or p_day not between (p_start at time zone tz)::date - 1 and (p_start at time zone tz)::date then
    raise exception 'pick a time from the free slots' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('booking:' || uid::text, 0));
  if (select count(*) from public.booking_requests b where b.user_id = uid and b.created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.booking_requests b where b.user_id = uid and b.created_at > now() - interval '1 day') >= 20 then
    raise exception 'too many requests right now, try again later' using errcode = 'P0001';
  end if;
  insert into public.booking_requests (user_id, day, start_at, end_at, name, note)
  values (uid, p_day, p_start, p_end, nm, nt)
  returning id into rid;
  insert into public.events (user_id, type, payload)
  values (uid, 'booking_requested', jsonb_build_object('id', rid));
  return rid;
end $$;

-- The owner answers a pending request. Accepting adds it to that day's plan as a fixed event
-- (an appointment in the Free block, titled with the requester's name).
create or replace function public.answer_booking(p_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  r public.booking_requests;
  tz text;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into r from public.booking_requests b where b.id = p_id and b.user_id = uid for update;
  if not found then
    raise exception 'request not found' using errcode = 'P0002';
  end if;
  if r.status <> 'pending' then
    raise exception 'already answered' using errcode = 'P0001';
  end if;
  update public.booking_requests set status = case when p_accept then 'accepted' else 'declined' end,
         answered_at = now()
  where id = p_id;
  if p_accept then
    tz := coalesce((select p.timezone from public.profiles p where p.user_id = uid), 'Asia/Bangkok');
    perform public.patch_day_plan(
      r.day, '{}'::jsonb, null,
      jsonb_build_array(jsonb_build_object(
        'id', 'booking-' || r.id::text, 'key', 'appointment', 'title', r.name, 'host', 'free',
        'start', to_char(r.start_at at time zone tz, 'HH24:MI'),
        'end', to_char(r.end_at at time zone tz, 'HH24:MI'))),
      null);
  end if;
  insert into public.events (user_id, type, payload)
  values (uid, 'booking_answered', jsonb_build_object('id', p_id, 'accepted', p_accept));
end $$;

revoke all on function public.share_link(boolean) from public, anon;
grant execute on function public.share_link(boolean) to authenticated;
revoke all on function public._share_blocks(jsonb) from public, anon, authenticated;
revoke all on function public._share_events(jsonb) from public, anon, authenticated;
revoke all on function public.share_context(text) from public;
grant execute on function public.share_context(text) to anon, authenticated;
revoke all on function public.request_slot(text, date, timestamptz, timestamptz, text, text) from public;
grant execute on function public.request_slot(text, date, timestamptz, timestamptz, text, text) to anon, authenticated;
revoke all on function public.answer_booking(uuid, boolean) from public, anon;
grant execute on function public.answer_booking(uuid, boolean) to authenticated;
