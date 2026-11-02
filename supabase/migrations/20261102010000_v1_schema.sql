-- 24/7 v1 schema (SPEC §10). Every table: user_id + RLS user_id = auth.uid().
-- Economy tables (game_state, inventory, seed_dex, gacha_pulls, animals, decor) are read-only
-- for clients; they change only through security-definer RPCs (added in M5/M7/M8).

-- ---------- helpers ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- profiles ----------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone text not null default 'Asia/Bangkok',
  locale text not null default 'en' check (locale in ('en', 'th')),
  sound_on boolean not null default true,
  onboarding jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- settings ----------
create table public.settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- [{key, duration_min, first10 (null = default text), checklist: [{id, label}]}] in chain order
  blocks jsonb not null,
  gym_close_time time not null default '22:00',
  weekly_exercise_goal smallint not null default 3 check (weekly_exercise_goal between 0 and 21),
  kaizen jsonb not null default '{"enabled": false, "step_min": 15, "floor": "08:30", "threshold": 5}'::jsonb,
  wake_window_min smallint not null default 15 check (wake_window_min between 0 and 120),
  tags jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------- templates ----------
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null, -- stable identifier, e.g. 'class_wed'; name null = use i18n default
  name text,
  weekdays smallint[] not null default '{}', -- ISO 1=Mon..7=Sun
  auto_apply boolean not null default true, -- used automatically on its weekdays
  target_wake time not null,
  -- optional "attending" toggle (Thu class): {attend_toggle, alt_target_wake}
  options jsonb not null default '{}'::jsonb,
  blocks jsonb not null default '{}'::jsonb, -- per-block overrides: durations, sub_slots, checklist, first10
  fixed_events jsonb not null default '[]'::jsonb, -- [{id, key, title, start, end}]
  sort smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

-- ---------- day plans ----------
create table public.day_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  template_id uuid references public.templates (id) on delete set null,
  attending boolean, -- for templates with an attend toggle
  bedtime_override timestamptz,
  planned jsonb, -- computed blocks snapshot from the engine
  overrides jsonb not null default '{}'::jsonb, -- per-day block/checklist/fixed-event overrides
  late_night jsonb, -- {return_at, planned: true}
  mode text not null default 'normal' check (mode in ('normal', 'vacation', 'sick')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

-- ---------- block logs ----------
create table public.block_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  block text not null check (block in ('down', 'sleep', 'wake', 'focus', 'work', 'gradation', 'free')),
  planned_start timestamptz,
  started_at timestamptz,
  first10_at timestamptz,
  closed_at timestamptz,
  items_done jsonb not null default '[]'::jsonb,
  items_planned smallint not null default 0,
  mood smallint check (mood between 1 and 5),
  energy smallint check (energy between 1 and 5),
  location text check (location in ('home', 'out')),
  backfilled boolean not null default false,
  planned_deviation boolean not null default false,
  miss_reason text check (miss_reason in ('sleepy', 'phone', 'interruption', 'social', 'sick', 'other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date, block)
);

-- ---------- backlog ----------
create table public.backlog_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  tag text,
  estimate_min integer check (estimate_min between 0 and 1440),
  priority text not null default 'should' check (priority in ('must', 'should', 'just_start')),
  deadline date,
  scheduled_date date,
  block text check (block in ('down', 'sleep', 'wake', 'focus', 'work', 'gradation', 'free')),
  status text not null default 'inbox' check (status in ('inbox', 'scheduled', 'done', 'dropped')),
  carry_count integer not null default 0,
  checklist jsonb not null default '[]'::jsonb,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- exercise ----------
create table public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  type text not null check (type in ('gym', 'run', 'walk', 'other')),
  minutes integer not null check (minutes between 1 and 600),
  created_at timestamptz not null default now()
);

-- ---------- wake events ----------
create table public.wake_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  target_wake timestamptz not null,
  pressed_at timestamptz not null,
  in_window boolean not null,
  backfilled boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

-- ---------- game (economy: read-only for clients) ----------
create table public.game_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  coins integer not null default 0 check (coins >= 0),
  tickets integer not null default 0 check (tickets >= 0),
  essence jsonb not null default '{}'::jsonb,
  pity jsonb not null default '{"since_rare": 0, "since_epic": 0, "since_legendary": 0}'::jsonb,
  streak integer not null default 0,
  best_streak integer not null default 0,
  freezes smallint not null default 0 check (freezes between 0 and 2),
  season text,
  updated_at timestamptz not null default now()
);

create table public.plots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  slot text not null, -- block key (down..free) or field_<n>
  crop_id text,
  star smallint not null default 1 check (star between 1 and 5),
  planted_on date,
  growth_days smallint not null default 0 check (growth_days >= 0),
  quality text not null default 'normal' check (quality in ('normal', 'silver', 'gold', 'prismatic')),
  mutations text[] not null default '{}',
  weeds boolean not null default false,
  wilt_level smallint not null default 0,
  state text not null default 'empty' check (state in ('empty', 'growing', 'ready', 'dead', 'compost', 'locked')),
  updated_at timestamptz not null default now(),
  unique (user_id, slot)
);

create table public.inventory (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null,
  qty integer not null default 0 check (qty >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create table public.seed_dex (
  user_id uuid not null references auth.users (id) on delete cascade,
  crop_id text not null,
  first_seen timestamptz not null default now(),
  count integer not null default 1,
  star smallint not null default 1 check (star between 1 and 5),
  primary key (user_id, crop_id)
);

create table public.animals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  species text not null,
  name text,
  love integer not null default 0,
  fed_until timestamptz,
  last_produced timestamptz,
  created_at timestamptz not null default now()
);

create table public.decor (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null,
  x real not null default 0,
  y real not null default 0,
  created_at timestamptz not null default now()
);

create table public.gacha_pulls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  banner text not null,
  result text not null,
  rarity text not null check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  pity_before jsonb not null,
  idempotency_key text
);

-- ---------- events (append-only) ----------
create table public.events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (char_length(type) between 1 and 64),
  payload jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);

-- ---------- indexes ----------
create index on public.templates (user_id);
create index on public.day_plans (user_id, date);
create index on public.block_logs (user_id, date);
create index on public.backlog_items (user_id, status, scheduled_date);
create index on public.backlog_items (user_id, deadline) where status <> 'done';
create index on public.exercise_logs (user_id, at desc);
create index on public.wake_events (user_id, date);
create index on public.plots (user_id);
create index on public.animals (user_id);
create index on public.decor (user_id);
create index on public.gacha_pulls (user_id, at desc);
create unique index gacha_pulls_idem on public.gacha_pulls (user_id, idempotency_key) where idempotency_key is not null;
create index on public.events (user_id, at desc);
create index on public.events (user_id, type, at desc);

-- ---------- updated_at triggers ----------
do $$
declare t text;
begin
  foreach t in array array['profiles','settings','templates','day_plans','block_logs','backlog_items','game_state','plots','inventory']
  loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------- RLS ----------
do $$
declare t text;
begin
  foreach t in array array['profiles','settings','templates','day_plans','block_logs','backlog_items','exercise_logs',
                           'wake_events','game_state','plots','inventory','seed_dex','animals','decor','gacha_pulls','events']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('create policy "own rows: select" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
  end loop;

  -- Fully user-editable tables.
  foreach t in array array['profiles','settings','templates','day_plans','block_logs','backlog_items','exercise_logs','wake_events','plots']
  loop
    execute format('create policy "own rows: insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy "own rows: update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy "own rows: delete" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- events: append-only (insert + select, never update/delete).
create policy "own rows: insert" on public.events for insert to authenticated with check (user_id = (select auth.uid()));

-- decor: positions are user-editable; buying/removing goes through RPCs.
create policy "own rows: update" on public.decor for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke update on public.decor from authenticated;
grant update (x, y) on public.decor to authenticated;

-- Anonymous users get nothing from any table.
revoke all on all tables in schema public from anon;
