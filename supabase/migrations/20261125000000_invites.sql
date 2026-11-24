-- Invites (docs/FRIENDS-DESIGN.md, Minnie 2026-11-24): an invite-only switch for the pilot, two
-- invite links per person (unlimited for Minnie), and one capsule ticket for both people when the
-- invited friend finishes their first lived minimum day. Everything is decided here, server-side.

-- ---------- the switch (global, service role only) ----------
create table public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
alter table public.app_config force row level security;
revoke all on public.app_config from anon, authenticated;

-- Off unless Minnie turns it on (admin page). `since`: accounts made before it keep their access.
create or replace function public.invite_only()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select value from public.app_config where key = 'invite_only'),
                  '{"on": false, "since": null}'::jsonb)
$$;
revoke all on function public.invite_only() from public;
grant execute on function public.invite_only() to anon, authenticated;

-- ---------- links and who came through them ----------
create table public.invite_links (
  user_id uuid primary key references auth.users (id) on delete cascade,
  token text not null unique check (token ~ '^[0-9a-f]{48}$'),
  -- How many friends may join through it; null = unlimited (Minnie, set from the admin page).
  quota integer default 2 check (quota is null or quota >= 0),
  -- Friends who joined through it, ever. Never goes down: a friend who deletes their account
  -- doesn't free their place (G7 INV F1).
  used integer not null default 0 check (used >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.invite_links enable row level security;
alter table public.invite_links force row level security;
create policy "own rows: select" on public.invite_links for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.invite_links from anon, authenticated;
grant select on public.invite_links to authenticated;

create table public.invites (
  -- The invited account (user_id, like every per-user table: RLS is user_id = auth.uid()).
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- The inviter's account may be deleted later; the friend keeps their access.
  inviter_id uuid references auth.users (id) on delete set null,
  joined_at timestamptz not null default now(),
  -- The friend's first lived minimum day, when both were paid (once).
  paid_on date
);
alter table public.invites enable row level security;
alter table public.invites force row level security;
create policy "own rows: select" on public.invites for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.invites from anon, authenticated;
grant select on public.invites to authenticated;
create index invites_by_inviter on public.invites (inviter_id);

alter table public.ticket_grants drop constraint if exists ticket_grants_reason_check;
alter table public.ticket_grants add constraint ticket_grants_reason_check
  check (reason in ('sunrise', 'night', 'perfect_day', 'weekly_review', 'streak_7', 'streak_14',
                    'streak_30', 'welcome_back', 'back_on_track', 'invite_joined'));

-- ---------- RPCs ----------
-- My link (made on first ask). p_new: a fresh token; the old link stops working.
create or replace function public.create_invite_link(p_new boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  row public.invite_links;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  -- A gated account can't let others in (G7 INV F4).
  if not coalesce((public.my_access() ->> 'allowed')::boolean, false) then
    raise exception 'no access' using errcode = 'P0001';
  end if;
  insert into public.invite_links (user_id, token)
  values (uid, encode(extensions.gen_random_bytes(24), 'hex'))
  on conflict (user_id) do update
    set token = case when p_new then encode(extensions.gen_random_bytes(24), 'hex')
                     else public.invite_links.token end,
        active = true
  returning * into row;
  insert into public.events (user_id, type, payload)
  values (uid, 'invite_link_created', jsonb_build_object('new', p_new));
  return jsonb_build_object('token', row.token, 'quota', row.quota);
end $$;

-- What my link has done: quota, how many joined, and their first names with paid or not.
create or replace function public.invite_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'token', l.token,
    'active', l.active,
    'quota', l.quota,
    'used', l.used,
    'joined', coalesce((select jsonb_agg(jsonb_build_object(
                          'name', nullif(left(p.display_name, 30), ''),
                          'paid', i.paid_on is not null) order by i.joined_at)
                        from public.invites i
                        left join public.profiles p on p.user_id = i.user_id
                        where i.inviter_id = l.user_id), '[]'::jsonb)
  )
  from public.invite_links l
  where l.user_id = auth.uid()
$$;

-- For the invite page (signed out): whose link it is and whether it still has room. Token-checked.
create or replace function public.invite_preview(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', nullif(left(p.display_name, 30), ''),
    'open', l.active and (l.quota is null or l.used < l.quota)
  )
  from public.invite_links l
  left join public.profiles p on p.user_id = l.user_id
  where l.token = p_token and p_token ~ '^[0-9a-f]{48}$'
$$;
revoke all on function public.invite_preview(text) from public;
grant execute on function public.invite_preview(text) to anon, authenticated;

-- A new account joins through a link. Once per account; refused for an old account, your own link,
-- a turned-off link or one with no room left (the inviter's row is locked, so two friends can't
-- both take the last place).
create or replace function public.claim_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  link public.invite_links;
  made timestamptz;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from public.invites where user_id = uid) then
    return jsonb_build_object('ok', true, 'already', true);
  end if;
  select * into link from public.invite_links where token = p_token for update;
  if not found or not link.active then
    raise exception 'no such invite' using errcode = 'P0001';
  end if;
  if link.user_id = uid then
    raise exception 'own invite' using errcode = 'P0001';
  end if;
  -- An account that already has access joins through an invite only while new (3 days), so an old
  -- account can't take a friend's place. A gated account (invite-only, no invite yet) may join at
  -- any age: that's the whole point of the link (G7 INV F2).
  select created_at into made from public.profiles where user_id = uid;
  if coalesce((public.my_access() ->> 'allowed')::boolean, false)
     and (made is null or made < now() - interval '3 days') then
    raise exception 'not a new account' using errcode = 'P0001';
  end if;
  if link.quota is not null and link.used >= link.quota then
    raise exception 'invite full' using errcode = 'P0001';
  end if;
  insert into public.invites (user_id, inviter_id) values (uid, link.user_id);
  update public.invite_links set used = used + 1 where user_id = link.user_id;
  insert into public.events (user_id, type, payload)
  values (uid, 'invite_claimed', '{}'::jsonb);
  return jsonb_build_object('ok', true, 'already', false);
end $$;

-- May this account use the app? With the switch on: joined through an invite, or made before it.
create or replace function public.my_access()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with cfg as (select public.invite_only() as v)
  select jsonb_build_object(
    'invite_only', coalesce((cfg.v ->> 'on')::boolean, false),
    'allowed',
      not coalesce((cfg.v ->> 'on')::boolean, false)
      or exists (select 1 from public.invites i where i.user_id = auth.uid())
      or exists (select 1 from public.profiles p where p.user_id = auth.uid()
                   and p.created_at < coalesce((cfg.v ->> 'since')::timestamptz, now()))
  )
  from cfg
$$;

revoke all on function public.create_invite_link(boolean) from public, anon;
grant execute on function public.create_invite_link(boolean) to authenticated;
revoke all on function public.invite_status() from public, anon;
grant execute on function public.invite_status() to authenticated;
revoke all on function public.claim_invite(text) from public, anon;
grant execute on function public.claim_invite(text) to authenticated;
revoke all on function public.my_access() from public, anon;
grant execute on function public.my_access() to authenticated;

-- ---------- the reward ----------
-- When an invited friend's day settles as minimum or perfect, and they really lived it (a live
-- check-in or a live "I'm up" that day, not only backfill), both get one ticket, once.
create or replace function public._pay_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invites;
begin
  if new.kind not in ('minimum', 'perfect') then
    return new;
  end if;
  select * into inv from public.invites where user_id = new.user_id and paid_on is null for update;
  if not found then
    return new;
  end if;
  if not (exists (select 1 from public.block_logs b
                  where b.user_id = new.user_id and b.date = new.date and not b.backfilled)
          or exists (select 1 from public.wake_events w
                     where w.user_id = new.user_id and w.date = new.date and not w.backfilled)) then
    return new;
  end if;
  update public.invites set paid_on = new.date where user_id = new.user_id;
  perform public._grant_once(new.user_id, 'invite_joined', new.date, 1);
  -- The inviter can have two friends finish on the same day, and the ledger's key is one grant per
  -- reason and date: so the inviter is paid straight, kept to once by `paid_on` (row locked above).
  if inv.inviter_id is not null then
    perform public._grant_tickets(inv.inviter_id, 1, 'invite_sent', jsonb_build_object('date', new.date));
  end if;
  insert into public.events (user_id, type, payload)
  values (new.user_id, 'invite_paid', jsonb_build_object('date', new.date));
  return new;
end $$;
revoke all on function public._pay_invite() from public, anon, authenticated;

drop trigger if exists day_results_pay_invite on public.day_results;
create trigger day_results_pay_invite after insert or update of kind on public.day_results
for each row execute function public._pay_invite();
