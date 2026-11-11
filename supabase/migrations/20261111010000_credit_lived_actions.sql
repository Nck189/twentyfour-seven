-- Playtest R1 R1 (Minnie OK 2026-11-11): what people actually do is credited. An in-window
-- "I'm up" is the Wake block's on-time start; the Night ritual done in time (its Night ticket) is
-- Down Time's. Before, both blocks only counted when "Start" was tapped within ±10 min, so their
-- plots died and Day score read 1–4% for people who did the habit. Mirrors lib/game/outcome
-- `credited` (blockResult, dayOee).
create or replace function public._credited(uid uuid, d date, p_block text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_block
    when 'wake' then exists (select 1 from public.wake_events
                             where user_id = uid and date = d and in_window and not backfilled)
    when 'down' then exists (select 1 from public.ticket_grants
                             where user_id = uid and reason = 'night' and ref_date = d)
    else false
  end;
$$;
revoke all on function public._credited(uuid, date, text) from public, anon, authenticated;

create or replace function public._plot_ripe(uid uuid, p public.plots, p_today date)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  need smallint := public._crop_grow_days(p.crop_id);
  d date;
  growth integer := 0;
  weeds boolean := false;
  streak integer := 0;
  lg public.block_logs;
  md text;
  r text;
begin
  if need is null or p.planted_on is null then
    return false;
  end if;
  d := greatest(p.planted_on, coalesce(p.harvested_on, p.planted_on)) + 1;
  while d <= p_today loop
    select * into lg from public.block_logs where user_id = uid and date = d and block = p.slot;
    select mode into md from public.day_plans where user_id = uid and date = d;
    r := public._block_result(lg, md, d = p_today);
    -- Lived actions count as the block's on-time start (playtest R1, Minnie 2026-11-11; TS
    -- `credited`): an in-window "I'm up" for Wake, the Night ticket (ritual in time) for Down.
    -- (Not a block set aside for the day: lib/game excuses a planned deviation before crediting.)
    if r <> 'success' and coalesce(md, 'normal') = 'normal' and not coalesce(lg.miss_reason is not null, false)
       and not coalesce(lg.planned_deviation, false)
       and public._credited(uid, d, p.slot) then
      r := 'success';
    end if;
    -- A planned late night (out late before d + 1, saved before that night) excuses that evening's
    -- Free (G7 R-M6-2, R-M9-1).
    if r in ('miss', 'partial') and p.slot = 'free'
       and public._late_night_planned(uid, d) then
      r := 'excused';
    end if;
    if r = 'success' then
      streak := 0;
      if not weeds then
        growth := growth + 1;
        if growth >= need then
          return true;
        end if;
      end if;
    elsif r = 'miss' then
      weeds := true;
      streak := streak + 1;
      if streak >= 5 then
        return false; -- dead
      end if;
      d := d + 1;
      continue; -- fresh weeds don't clear the same day
    elsif r in ('partial', 'backfilled') then
      streak := 0;
    end if;
    -- Minimum day: a live in-window "I'm up" + the Night ticket for that day.
    if weeds and r <> 'open'
       and exists (select 1 from public.wake_events
                   where user_id = uid and date = d and in_window and not backfilled)
       and exists (select 1 from public.ticket_grants
                   where user_id = uid and reason = 'night' and ref_date = d) then
      weeds := false;
    end if;
    d := d + 1;
  end loop;
  return false;
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
    elsif lg.id is not null and not lg.backfilled and lg.planned_start is not null
       and lg.started_at is not null
       and abs(extract(epoch from lg.started_at - lg.planned_start)) <= 600 then
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
