-- Story beats with Som, the orange farm cat (docs/STORY.md, Minnie 2026-11-12).
-- The client's director (lib/game/director.ts) picks a beat at a calm moment; the server records
-- it once, re-checks its trigger from data, keeps it to one beat per wake-day, and grants the gift.
-- Beats and gifts mirror content/story.ts (tests/integration/story.test.ts checks the gifts).

create table public.story_seen (
  user_id uuid not null references auth.users (id) on delete cascade,
  beat text not null check (char_length(beat) between 1 and 64),
  day date not null,
  gift jsonb,
  seen_at timestamptz not null default now(),
  primary key (user_id, beat)
);
create index story_seen_day on public.story_seen (user_id, day);
alter table public.story_seen enable row level security;
alter table public.story_seen force row level security;
create policy "own rows: select" on public.story_seen for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.story_seen from anon, authenticated;
grant select on public.story_seen to authenticated;

-- What the beats count, from server facts.
create or replace function public._story_facts(uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'harvests', (select count(*) from public.events e where e.user_id = uid and e.type = 'harvest'),
    'good_days', (select count(*) from public.day_results d
                  where d.user_id = uid and d.kind in ('perfect', 'minimum'))
  )
$$;

-- null = unknown beat.
create or replace function public._story_ready(uid uuid, p_beat text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  f jsonb := public._story_facts(uid);
begin
  return case p_beat
    when 'ch0_gate' then true
    when 'ch1_first_harvest' then (f ->> 'harvests')::integer >= 1
    when 'ch2_watering_can' then (f ->> 'good_days')::integer >= 3
  end;
end $$;

create or replace function public._story_gift(p_beat text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case p_beat
    when 'ch1_first_harvest' then '{"seed": {"crop": "radish", "n": 1}}'::jsonb
    when 'ch2_watering_can' then '{"tickets": 1}'::jsonb
  end
$$;

-- {seen: [beat…], today: bool, facts: {harvests, good_days}}
create or replace function public.story_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  d date;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  d := public._wake_day(uid);
  return jsonb_build_object(
    'seen', coalesce((select jsonb_agg(s.beat order by s.seen_at) from public.story_seen s where s.user_id = uid), '[]'::jsonb),
    'today', exists (select 1 from public.story_seen s where s.user_id = uid and s.day = d),
    'facts', public._story_facts(uid)
  );
end $$;

-- Records a beat as seen (once, one per wake-day, only when its trigger holds) and grants its gift.
create or replace function public.claim_story_beat(p_beat text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  ready boolean;
  gift jsonb := public._story_gift(p_beat);
  d date;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  ready := public._story_ready(uid, p_beat);
  if ready is null then
    raise exception 'unknown beat' using errcode = '22023';
  end if;
  -- Serialize this user's claims (parallel taps / tabs).
  perform 1 from public.game_state where user_id = uid for update;
  if exists (select 1 from public.story_seen where user_id = uid and beat = p_beat) then
    raise exception 'already seen' using errcode = 'P0001';
  end if;
  d := public._wake_day(uid);
  if exists (select 1 from public.story_seen where user_id = uid and day = d) then
    raise exception 'one beat a day' using errcode = 'P0001';
  end if;
  if not ready then
    raise exception 'not yet' using errcode = 'P0001';
  end if;
  insert into public.story_seen (user_id, beat, day, gift) values (uid, p_beat, d, gift);
  if gift ? 'tickets' then
    update public.game_state set tickets = tickets + (gift ->> 'tickets')::integer where user_id = uid;
  end if;
  if gift ? 'seed' then
    insert into public.inventory (user_id, item_id, qty)
    values (uid, 'seed:' || (gift -> 'seed' ->> 'crop'), (gift -> 'seed' ->> 'n')::integer)
    on conflict (user_id, item_id) do update set qty = public.inventory.qty + excluded.qty;
  end if;
  insert into public.events (user_id, type, payload)
  values (uid, 'story_seen', jsonb_build_object('beat', p_beat, 'gift', gift));
  return jsonb_build_object('beat', p_beat, 'gift', gift);
end $$;

revoke all on function public._story_facts(uuid) from public, anon, authenticated;
revoke all on function public._story_ready(uuid, text) from public, anon, authenticated;
revoke all on function public._story_gift(text) from public, anon, authenticated;
revoke all on function public.story_status() from public, anon;
revoke all on function public.claim_story_beat(text) from public, anon;
grant execute on function public.story_status() to authenticated;
grant execute on function public.claim_story_beat(text) to authenticated;
