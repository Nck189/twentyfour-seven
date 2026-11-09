-- M10 weekly review (SPEC §7): on Sunday night, a look back at the week plus Keep / Problem / Try,
-- for +3 tickets once per week (the `weekly_review` reason already exists in ticket_grants).
-- A week is Monday–Sunday by wake-day. The review opens on the week's Sunday and stays open
-- through Monday (a grace day for people who do it the next morning).

create table public.weekly_reviews (
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  keep text not null check (char_length(keep) between 1 and 280),
  problem text not null check (char_length(problem) between 1 and 280),
  try text not null check (char_length(try) between 1 and 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, week_start)
);
alter table public.weekly_reviews enable row level security;
alter table public.weekly_reviews force row level security;
create policy "own rows: select" on public.weekly_reviews for select to authenticated
  using (user_id = (select auth.uid()));
-- No insert/update/delete policies: only submit_weekly_review writes it.
revoke all on public.weekly_reviews from anon, authenticated;
grant select on public.weekly_reviews to authenticated;

-- The week a review is for right now, or null when no review is open: on the week's Sunday
-- (wake-day) and the Monday after it.
-- Only weeks the account was around for at least from Thursday (G7 R-M10-6: signing up on a
-- Sunday doesn't review — or pay for — a week that never happened).
create or replace function public._review_week(uid uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select case when wk is not null and created_on <= wk + 3 then wk end
  from (
    select case extract(isodow from d)::integer when 7 then d - 6 when 1 then d - 7 end as wk,
           -- UTC, not the (client-editable) profile timezone (G7 R-M10-R3).
           (select (p.created_at at time zone 'UTC')::date
              from public.profiles p where p.user_id = uid) as created_on
    from (select public._wake_day(uid) as d) t
  ) x;
$$;

-- Saves this week's Keep / Problem / Try (editable while the review is open) and pays +3 tickets
-- the first time. Returns {week_start, granted, open}.
create or replace function public.submit_weekly_review(p_keep text, p_problem text, p_try text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  wk date;
  -- Trim every kind of blank, incl. no-break, ideographic and zero-width spaces (R-M10-R6).
  k text := regexp_replace(coalesce(p_keep, ''), '^[\s\u00a0\u3000\u200b\ufeff]+|[\s\u00a0\u3000\u200b\ufeff]+$', '', 'g');
  p text := regexp_replace(coalesce(p_problem, ''), '^[\s\u00a0\u3000\u200b\ufeff]+|[\s\u00a0\u3000\u200b\ufeff]+$', '', 'g');
  t text := regexp_replace(coalesce(p_try, ''), '^[\s\u00a0\u3000\u200b\ufeff]+|[\s\u00a0\u3000\u200b\ufeff]+$', '', 'g');
  granted boolean;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  perform 1 from public.game_state where user_id = uid for update;
  wk := public._review_week(uid);
  if wk is null then
    raise exception 'the weekly review opens on Sunday' using errcode = 'P0001';
  end if;
  if k = '' or p = '' or t = '' then
    raise exception 'keep, problem and try are all needed' using errcode = '22023';
  end if;
  if char_length(k) > 280 or char_length(p) > 280 or char_length(t) > 280 then
    raise exception 'each answer is at most 280 characters' using errcode = '22023';
  end if;
  insert into public.weekly_reviews (user_id, week_start, keep, problem, try)
  values (uid, wk, k, p, t)
  on conflict (user_id, week_start) do update
    set keep = excluded.keep, problem = excluded.problem, try = excluded.try, updated_at = now();
  granted := public._grant_once(uid, 'weekly_review', wk, 3);
  -- One event per week's review (the first save), not one per edit.
  if granted then
    insert into public.events (user_id, type, payload)
    values (uid, 'weekly_review_done', jsonb_build_object('week_start', wk, 'tickets', 3));
  end if;
  return jsonb_build_object('week_start', wk, 'granted', granted);
end $$;

-- Which week's review is open now (null = none), and whether it's done: drives the Sunday card.
create or replace function public.weekly_review_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  wk date;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  wk := public._review_week(uid);
  return jsonb_build_object(
    'week_start', wk,
    'done', wk is not null and exists (
      select 1 from public.weekly_reviews r where r.user_id = uid and r.week_start = wk));
end $$;

-- Weekly reviews are server-written events.
drop policy if exists "own rows: insert" on public.events;
create policy "own rows: insert" on public.events for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and type not in ('ticket_granted', 'wake_pressed', 'wake_backfilled', 'night_ritual_completed',
                     'gacha_pull', 'coins_granted', 'essence_granted', 'egg_hatched', 'harvest',
                     'seed_planted', 'decor_bought', 'star_up', 'unlock_granted',
                     'exercise_logged', 'animal_petted', 'produce_collected', 'animal_fed',
                     'days_settled', 'weekly_review_done')
  );

revoke all on function public._review_week(uuid) from public, anon, authenticated;
revoke all on function public.submit_weekly_review(text, text, text) from public, anon;
grant execute on function public.submit_weekly_review(text, text, text) to authenticated;
revoke all on function public.weekly_review_status() from public, anon;
grant execute on function public.weekly_review_status() to authenticated;

-- ---------- first-time tips (Minnie, 2026-11-09) ----------
-- Which tips this account has seen, and whether they're all skipped. Plain profile fields the
-- app updates itself (like `onboarding`); nothing depends on them.
alter table public.profiles add column tips_seen text[] not null default '{}';
alter table public.profiles add column tips_off boolean not null default false;
-- Accounts that exist before this migration already know the app: their tips count as seen
-- (More → "Show tips again" brings them back). Profiles have no triggers on these columns.
update public.profiles
   set tips_seen = array['wake', 'first10', 'night', 'exercise', 'streak', 'plan', 'plots', 'capsule'];

-- Only the tip ids the app knows (content/tips.ts), at most once each (R-M10-10).
alter table public.profiles add constraint profiles_tips_seen_known
  check (tips_seen <@ array['wake', 'first10', 'night', 'exercise', 'streak', 'plan', 'plots', 'capsule']
         and cardinality(tips_seen) <= 8);

-- Clients update only the profile fields the app edits (G7 R-M10-R3: created_at decides which
-- weeks get a review and where Stats start).
revoke update on public.profiles from authenticated;
grant update (display_name, timezone, locale, sound_on, onboarding, tips_seen, tips_off)
  on public.profiles to authenticated;
