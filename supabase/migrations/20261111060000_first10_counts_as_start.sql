-- G7 R1-fixes F2: R1 (Minnie OK 2026-11-11) also said "a first-10 done within the block counts as a
-- start". A block's start now counts when it began on time (±10 min) or its first-10 was done live
-- once the block had begun. Mirrors lib/game `startCounts` (blockResult, dayOee).

create or replace function public._start_counts(lg public.block_logs)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lg.id is not null and not lg.backfilled and lg.planned_start is not null and (
    (lg.started_at is not null and abs(extract(epoch from lg.started_at - lg.planned_start)) <= 600)
    or (lg.first10_at is not null and lg.first10_at >= lg.planned_start - interval '10 minutes'))
$$;
revoke all on function public._start_counts(public.block_logs) from public, anon, authenticated;

create or replace function public._block_result(lg public.block_logs, p_mode text, p_open boolean)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if coalesce(p_mode, 'normal') <> 'normal' then
    return 'excused';
  end if;
  if lg.id is not null then
    if lg.planned_deviation then
      return 'excused';
    end if;
    if lg.miss_reason is not null then
      return 'miss';
    end if;
    if lg.backfilled then
      return 'backfilled';
    end if;
    -- Its start counts (on time ±10 min, or a live first-10 once it began) or checklist ≥ 70%.
    if public._start_counts(lg)
       or (lg.items_planned > 0
           and least(1.0, jsonb_array_length(lg.items_done)::numeric / lg.items_planned) >= 0.7) then
      return 'success';
    end if;
  end if;
  if p_open then
    return 'open';
  end if;
  if lg.id is not null and lg.started_at is not null then
    return 'partial';
  end if;
  return 'miss';
end $$;

create or replace function public._day_oee(uid uuid, d date)
returns real
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  k text;
  lg public.block_logs;
  planned integer := 0;
  on_time integer := 0;
  first10 integer := 0;
  done integer := 0;
  items integer := 0;
  m text;
begin
  select mode into m from public.day_plans where user_id = uid and date = d;
  if coalesce(m, 'normal') <> 'normal' then
    return null;
  end if;
  foreach k in array array['down', 'sleep', 'wake', 'focus', 'work', 'gradation', 'free'] loop
    select * into lg from public.block_logs where user_id = uid and date = d and block = k;
    if lg.id is not null and lg.planned_deviation then
      continue;
    end if;
    planned := planned + 1;
    if (lg.id is null or lg.miss_reason is null) and public._credited(uid, d, k) then
      on_time := on_time + 1;
    elsif lg.id is not null and public._start_counts(lg) then
      on_time := on_time + 1;
    end if;
    if lg.id is null then
      continue;
    end if;
    if not lg.backfilled and lg.first10_at is not null then
      first10 := first10 + 1;
    end if;
    if lg.items_planned > 0 then
      items := items + lg.items_planned;
      done := done + least(case when jsonb_typeof(lg.items_done) = 'array'
                                then jsonb_array_length(lg.items_done) else 0 end, lg.items_planned);
    end if;
  end loop;
  if planned = 0 then
    return null;
  end if;
  return (on_time::real / planned)
       * (case when items > 0 then done::real / items else 1 end)
       * (first10::real / planned);
end $$;
