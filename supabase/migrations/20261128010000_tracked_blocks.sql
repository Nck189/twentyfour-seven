-- Rule B (Minnie OK 2026-11-27, docs/DECISIONS.md): a person chooses which optional blocks to track
-- (settings.blocks[].tracked = false leaves one out; Wake, Down Time and Sleep are always tracked).
-- An untracked block has no check-in on Today and is left out of the Day score, so it can't drag
-- a Perfect day (+1 ticket) or the rainbow weather down. Its plot grows on every kept day (an
-- in-window "I'm up" or the Night ticket) instead, at normal quality, so a farm stays alive for
-- someone tracking only the anchors. Mirrors lib/game `dayOee` + `simulatePlot` (`untracked`).

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
    -- A block this person doesn't track is out of the Day score (lib/game dayOee, rule B).
    if k not in ('wake', 'down', 'sleep') and exists (
         select 1 from public.settings s, jsonb_array_elements(s.blocks) e
         where s.user_id = uid and e ->> 'key' = k and e ->> 'tracked' = 'false') then
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
revoke all on function public._day_oee(uuid, date) from public, anon, authenticated;
grant execute on function public._day_oee(uuid, date) to service_role;

create or replace function public._plot_harvest(uid uuid, p public.plots, p_today date)
returns jsonb
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
  wilt integer := 0;
  rec_days integer := 0;
  f10_days integer := 0;
  rate_sum numeric := 0;
  rate_n integer := 0;
  muts text[] := '{}';
  weather text[];
  lg public.block_logs;
  md text;
  r text;
  ripe boolean := false;
  dead boolean := false;
  score numeric;
  idx integer := 0;
  n_done integer;
  -- Rule B: a plot whose block isn't tracked grows on every kept day (lib/game simulatePlot).
  untracked boolean := p.slot not in ('wake', 'down', 'sleep') and exists (
    select 1 from public.settings s, jsonb_array_elements(s.blocks) e
    where s.user_id = uid and e ->> 'key' = p.slot and e ->> 'tracked' = 'false');
begin
  if need is null or p.planted_on is null then
    return jsonb_build_object('ripe', false, 'dead', false, 'quality', 'normal', 'mult', 1, 'growth', 0);
  end if;
  d := greatest(p.planted_on, coalesce(p.harvested_on, p.planted_on)) + 1;
  while d <= p_today and not ripe and not dead loop
    weather := public._earned_mutations(uid, d - 1);
    select * into lg from public.block_logs where user_id = uid and date = d and block = p.slot;
    select mode into md from public.day_plans where user_id = uid and date = d;
    r := public._block_result(lg, md, d = p_today);
    if d < p_today and public._away_day(uid, d) then
      r := 'excused';
    end if;
    if r <> 'success' and coalesce(md, 'normal') = 'normal' and not coalesce(lg.miss_reason is not null, false)
       and not coalesce(lg.planned_deviation, false)
       and public._credited(uid, d, p.slot) then
      r := 'success';
    end if;
    if r in ('miss', 'partial') and p.slot = 'free' and public._late_night_planned(uid, d) then
      r := 'excused';
    end if;
    if r <> 'success' and untracked and d < p_today and coalesce(md, 'normal') = 'normal'
       and (exists (select 1 from public.wake_events
                    where user_id = uid and date = d and in_window and not backfilled)
            or exists (select 1 from public.ticket_grants
                       where user_id = uid and reason = 'night' and ref_date = d)) then
      r := 'success';
    end if;
    if r = 'success' and not weeds then
      growth := growth + 1;
      rec_days := rec_days + 1;
      if lg.id is not null and not lg.backfilled and lg.first10_at is not null then
        f10_days := f10_days + 1;
      end if;
      if lg.id is not null and lg.items_planned > 0 then
        n_done := case when jsonb_typeof(lg.items_done) = 'array' then jsonb_array_length(lg.items_done) else 0 end;
        rate_sum := rate_sum + least(1, n_done::numeric / lg.items_planned);
        rate_n := rate_n + 1;
      end if;
      muts := muts || weather;
      if growth >= need then
        ripe := true; -- a ready crop waits: this day's health no longer touches it
      end if;
    end if;
    -- The day's health (lib/game farmDay): today is open; Vacation/Sick pauses; one live anchor
    -- keeps the day; live check-ins with neither anchor miss it; anything else is a quiet day.
    if not ripe and d < p_today and coalesce(md, 'normal') = 'normal' then
      if exists (select 1 from public.wake_events
                 where user_id = uid and date = d and in_window and not backfilled)
         or exists (select 1 from public.ticket_grants
                    where user_id = uid and reason = 'night' and ref_date = d) then
        streak := 0;
        weeds := false;
      elsif exists (select 1 from public.block_logs b
                    where b.user_id = uid and b.date = d and not b.backfilled
                      and (b.started_at is not null or b.first10_at is not null
                           or (jsonb_typeof(b.items_done) = 'array'
                               and jsonb_array_length(b.items_done) > 0))) then
        streak := streak + 1;
        if streak >= 2 then
          weeds := true;
        end if;
        if streak % 3 = 0 then
          wilt := wilt + 1;
        end if;
        if streak >= 5 then
          dead := true;
        end if;
      end if;
    end if;
    d := d + 1;
  end loop;
  -- Quality (lib/game qualityOf): first-10 rate, averaged with the checklist rate; +5% per star
  -- above 1; one step down per wilt.
  if rec_days = 0 then
    score := 0;
  else
    score := f10_days::numeric / rec_days;
    if rate_n > 0 then
      score := (score + rate_sum / rate_n) / 2;
    end if;
    score := least(1, score + greatest(0, p.star - 1) * 0.05);
  end if;
  if score >= 0.4 then idx := 1; end if;
  if score >= 0.7 then idx := 2; end if;
  if score >= 0.9 then idx := 3; end if;
  idx := greatest(0, idx - wilt);
  return jsonb_build_object(
    'ripe', ripe,
    'dead', dead,
    'growth', growth,
    'quality', (array['normal', 'silver', 'gold', 'prismatic'])[idx + 1],
    'mult', public._mutation_multiplier(muts));
end $$;
revoke all on function public._plot_harvest(uuid, public.plots, date) from public, anon, authenticated;
