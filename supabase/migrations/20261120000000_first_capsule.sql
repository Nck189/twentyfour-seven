-- Review fix C4 (docs/REVIEW_FIX_PLAN.md): a new player opens a first capsule in the first minute.
-- Setting sleep times (the first setup step) now pays one capsule ticket with its 2 strawberry
-- seeds. _grant_unlock already pays every key a reward has (seed and tickets both), once per
-- account through unlock_grants: accounts that already claimed sleep_times get nothing more.
-- Mirrors content/unlocks.ts SETUP_REWARD (tests/unit/unlocks-sql.test.ts checks it).

create or replace function public._setup_reward(p_id text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case p_id
    when 'sleep_times' then '{"seed": {"crop": "strawberry", "n": 2}, "tickets": 1}'::jsonb
    when 'first10' then '{"tickets": 1}'::jsonb
    when 'checklist' then '{"coins": 20}'::jsonb
    when 'backlog_estimate' then '{"coins": 15}'::jsonb
    when 'language' then '{"coins": 5}'::jsonb
    when 'home_screen' then '{"decor": "flowers"}'::jsonb
    when 'exercise' then '{"feed": 3}'::jsonb
    when 'notifications' then '{"decor": "wind_chime"}'::jsonb
    -- unlock ladder (SPEC §8.8b, content/unlocks.ts UNLOCKS)
    when 'first_night' then '{"decor": "garden_lantern"}'::jsonb
    when 'first_backlog' then '{"decor": "mailbox"}'::jsonb
    when 'all_first10_day' then '{"seed": {"crop": "sunflower", "n": 1}}'::jsonb
    when 'first10_20' then '{"tickets": 2}'::jsonb
    when 'must_10' then '{"coins": 50}'::jsonb
    when 'streak_7' then '{"egg": 1}'::jsonb
    when 'streak_30' then '{"decor": "pond"}'::jsonb
    when 'blocks_100' then '{"coins": 150}'::jsonb
  end
$$;
