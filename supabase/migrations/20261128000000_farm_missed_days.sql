-- Rule A (Minnie OK 2026-11-27, docs/DECISIONS.md): the farm is hurt by missed days, not missed
-- blocks. A block only ever helps (its success grows the crop); a skipped block just doesn't grow.
-- A missed day = a finished, active day with neither a live in-window "I'm up" nor the Night
-- ritual. 1 in a row = a warning only ("never miss twice"); 2 → weeds; every 3rd → wilt; 5 → dead.
-- One anchor keeps the day and clears the weeds at its end. Vacation/Sick, away days and a planned
-- late night pause the run. Mirrors lib/game `simulatePlot` + `farmDay` (harvest-parity test).

-- One planting replayed to p_today (lib/game simulatePlot). Returns
-- { ripe, dead, quality, mult, growth }.
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
    -- The day's health (lib/game farmDay): today is open; Vacation/Sick, away and a planned late
    -- night pause; one live anchor keeps the day; an active day with neither is missed.
    if not ripe and d < p_today then
      if coalesce(md, 'normal') <> 'normal' or public._away_day(uid, d)
         or public._late_night_planned(uid, d) then
        null;
      elsif exists (select 1 from public.wake_events
                    where user_id = uid and date = d and in_window and not backfilled)
            or exists (select 1 from public.ticket_grants
                       where user_id = uid and reason = 'night' and ref_date = d) then
        streak := 0;
        weeds := false;
      else
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
