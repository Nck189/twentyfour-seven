-- M7: setup rewards (SPEC §8.8c). Each one-time setup step pays a small reward once, granted here
-- when the setting really exists in the data (never on a button tap alone). The ledger is the same
-- one the unlock ladder (§8.8b, M9) will use. Rewards mirror content/unlocks.ts (a unit test checks).

create table public.unlock_grants (
  user_id uuid not null references auth.users (id) on delete cascade,
  unlock_id text not null,
  reward jsonb not null,
  at timestamptz not null default now(),
  primary key (user_id, unlock_id)
);
alter table public.unlock_grants enable row level security;
alter table public.unlock_grants force row level security;
create policy "own rows: select" on public.unlock_grants for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.unlock_grants from anon;
revoke insert, update, delete on public.unlock_grants from authenticated;

-- Reward per setup step: {tickets?, coins?, seed?: {crop, n}, decor?}. Null = unknown step.
create or replace function public._setup_reward(p_id text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case p_id
    when 'sleep_times' then '{"seed": {"crop": "strawberry", "n": 2}}'::jsonb
    when 'first10' then '{"tickets": 1}'::jsonb
    when 'checklist' then '{"coins": 20}'::jsonb
    when 'backlog_estimate' then '{"coins": 15}'::jsonb
    when 'language' then '{"coins": 5}'::jsonb
    when 'home_screen' then '{"decor": "flowers"}'::jsonb
  end
$$;

-- Pays one reward once. Returns true when newly granted.
create or replace function public._grant_unlock(uid uuid, p_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  reward jsonb := public._setup_reward(p_id);
  inserted integer;
  n integer;
begin
  if reward is null then
    raise exception 'unknown unlock' using errcode = '22023';
  end if;
  insert into public.unlock_grants (user_id, unlock_id, reward) values (uid, p_id, reward)
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return false;
  end if;
  if reward ? 'tickets' then
    update public.game_state set tickets = tickets + (reward ->> 'tickets')::integer where user_id = uid;
  end if;
  if reward ? 'coins' then
    update public.game_state set coins = coins + (reward ->> 'coins')::integer where user_id = uid;
  end if;
  if reward ? 'seed' then
    insert into public.inventory (user_id, item_id, qty)
    values (uid, 'seed:' || (reward -> 'seed' ->> 'crop'), (reward -> 'seed' ->> 'n')::integer)
    on conflict (user_id, item_id) do update set qty = public.inventory.qty + excluded.qty;
  end if;
  if reward ? 'decor' then
    select count(*) into n from public.decor where user_id = uid and item_id = reward ->> 'decor';
    insert into public.decor (user_id, item_id, x, y) values (uid, reward ->> 'decor', n, 0);
  end if;
  insert into public.events (user_id, type, payload)
  values (uid, 'unlock_granted', jsonb_build_object('unlock', p_id, 'reward', reward));
  return true;
end $$;

-- Which setup steps exist in this user's data right now (home_screen is reported, not derived).
create or replace function public._setup_done(uid uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_remove(array[
    case when exists (
      select 1 from public.profiles p where p.user_id = uid and (p.onboarding ->> 'done') = 'true'
    ) or exists (
      select 1 from public.templates t where t.user_id = uid and t.updated_at > t.created_at + interval '1 second'
    ) then 'sleep_times' end,
    case when exists (
      select 1 from public.settings s, jsonb_array_elements(case when jsonb_typeof(s.blocks) = 'array' then s.blocks else '[]'::jsonb end) b
      where s.user_id = uid and jsonb_typeof(b -> 'first10') = 'string' and length(b ->> 'first10') > 0
    ) then 'first10' end,
    case when exists (
      select 1 from public.settings s, jsonb_array_elements(case when jsonb_typeof(s.blocks) = 'array' then s.blocks else '[]'::jsonb end) b
      where s.user_id = uid and jsonb_typeof(b -> 'checklist') = 'array' and jsonb_array_length(b -> 'checklist') > 0
    ) or exists (
      select 1 from public.templates t, jsonb_each(case when jsonb_typeof(t.blocks) = 'object' then t.blocks else '{}'::jsonb end) o
      where t.user_id = uid and jsonb_typeof(o.value) = 'object'
        and jsonb_typeof(o.value -> 'checklist') = 'array' and jsonb_array_length(o.value -> 'checklist') > 0
    ) or exists (
      select 1 from public.day_plans d, jsonb_each(case when jsonb_typeof(d.overrides -> 'blocks') = 'object'
                                                        then d.overrides -> 'blocks' else '{}'::jsonb end) o
      where d.user_id = uid and jsonb_typeof(o.value) = 'object'
        and jsonb_typeof(o.value -> 'checklist') = 'array' and jsonb_array_length(o.value -> 'checklist') > 0
    ) then 'checklist' end,
    case when exists (
      select 1 from public.backlog_items i where i.user_id = uid and coalesce(i.estimate_min, 0) > 0
    ) then 'backlog_estimate' end,
    case when exists (
      select 1 from public.events e where e.user_id = uid and e.type = 'locale_changed'
    ) then 'language' end
  ], null)
$$;

-- Grants every setup step that's done and not yet paid. Returns {done, granted} (step ids).
create or replace function public.claim_setup_rewards()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  step text;
  granted text[] := '{}';
  paid text[];
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  -- One claim at a time per user (two tabs): the ledger's key keeps it single-pay anyway.
  perform 1 from public.game_state where user_id = uid for update;
  foreach step in array public._setup_done(uid) loop
    if public._grant_unlock(uid, step) then
      granted := granted || step;
    end if;
  end loop;
  select coalesce(array_agg(unlock_id order by unlock_id), '{}') into paid
  from public.unlock_grants where user_id = uid;
  return jsonb_build_object('done', to_jsonb(paid), 'granted', to_jsonb(granted));
end $$;

-- The app was opened from the Home Screen (the device's word: no server can see an install).
-- Small and once per account.
create or replace function public.report_home_screen()
returns jsonb
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
  return jsonb_build_object('granted', public._grant_unlock(uid, 'home_screen'));
end $$;

-- Grants are server-only events (the audit log can't be faked).
drop policy if exists "own rows: insert" on public.events;
create policy "own rows: insert" on public.events for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and type not in ('ticket_granted', 'wake_pressed', 'wake_backfilled', 'night_ritual_completed',
                     'gacha_pull', 'coins_granted', 'essence_granted', 'egg_hatched', 'harvest',
                     'seed_planted', 'decor_bought', 'star_up', 'unlock_granted')
  );

revoke all on function public._setup_reward(text) from public, anon, authenticated;
revoke all on function public._grant_unlock(uuid, text) from public, anon, authenticated;
revoke all on function public._setup_done(uuid) from public, anon, authenticated;
revoke all on function public.claim_setup_rewards() from public, anon;
grant execute on function public.claim_setup_rewards() to authenticated;
revoke all on function public.report_home_screen() from public, anon;
grant execute on function public.report_home_screen() to authenticated;
