-- Economy v2 (docs/ECONOMY.md, Minnie OK 2026-11-11), step 1: the server judges a harvest's
-- quality and weather, so the market can pay for them without trusting the client.
-- `_plot_harvest` replays a planting day by day exactly like lib/game `simulatePlot` (growth,
-- weeds, wilt, death, quality, weather) and `_plot_ripe` now reads it. Produce is kept as
-- `crop:<id>:<quality>:<weather ×100>`; older `crop:<id>` stock counts as normal, no weather.

-- The mutations a day earns (lib/game `earnedMutations`); they are the next day's weather.
create or replace function public._earned_mutations(uid uuid, d date)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  m text;
  tz text;
  wk public.block_logs;
  dn public.block_logs;
  out_ text[] := '{}';
begin
  select mode into m from public.day_plans where user_id = uid and date = d;
  if coalesce(m, 'normal') <> 'normal' then
    return out_;
  end if;
  select coalesce(timezone, 'Asia/Bangkok') into tz from public.profiles where user_id = uid;
  select * into wk from public.block_logs where user_id = uid and date = d and block = 'wake';
  select * into dn from public.block_logs where user_id = uid and date = d and block = 'down';
  if exists (select 1 from public.wake_events
             where user_id = uid and date = d and in_window and not backfilled) then
    out_ := array_append(out_, 'sunrise_glow');
  end if;
  if wk.id is not null and not wk.backfilled and wk.first10_at is not null then
    out_ := array_append(out_, 'dew');
  end if;
  if dn.id is not null and not dn.backfilled and dn.first10_at is not null
     and dn.planned_start is not null and dn.started_at is not null
     and abs(extract(epoch from dn.started_at - dn.planned_start)) <= 600 then
    out_ := array_append(out_, 'moonlit');
  end if;
  if exists (select 1 from public.block_logs
             where user_id = uid and date = d and block in ('focus', 'work')
               and not backfilled and location = 'out' and started_at is not null) then
    out_ := array_append(out_, 'breeze');
  end if;
  if exists (select 1 from public.exercise_logs e
             where e.user_id = uid and (e.at at time zone tz)::date = d) then
    out_ := array_append(out_, 'spark');
  end if;
  -- Perfect day: a minimum day + Day score ≥ 80%.
  if exists (select 1 from public.wake_events
             where user_id = uid and date = d and in_window and not backfilled)
     and exists (select 1 from public.ticket_grants
                 where user_id = uid and reason = 'night' and ref_date = d)
     and coalesce(public._day_oee(uid, d), 0) >= 0.8 then
    out_ := array_append(out_, 'rainbow');
  end if;
  return out_;
end $$;

create or replace function public._mutation_multiplier(p_ids text[])
returns numeric
language sql
immutable
set search_path = ''
as $$
  select coalesce(exp(sum(ln(case id
    when 'sunrise_glow' then 2 when 'dew' then 1.5 when 'moonlit' then 2
    when 'breeze' then 1.5 when 'spark' then 2 when 'rainbow' then 5 else 1 end))), 1)::numeric
  from (select distinct unnest(p_ids) as id) x
$$;

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
    if r = 'success' then
      streak := 0;
      if not weeds then
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
          ripe := true;
        end if;
      end if;
    elsif r = 'miss' then
      weeds := true;
      streak := streak + 1;
      if streak % 3 = 0 then
        wilt := wilt + 1;
      end if;
      if streak >= 5 then
        dead := true;
      end if;
      d := d + 1;
      continue; -- fresh weeds don't clear the same day
    elsif r in ('partial', 'backfilled') then
      streak := 0;
    end if;
    if weeds and r <> 'open'
       and exists (select 1 from public.wake_events
                   where user_id = uid and date = d and in_window and not backfilled)
       and exists (select 1 from public.ticket_grants
                   where user_id = uid and reason = 'night' and ref_date = d) then
      weeds := false;
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

create or replace function public._plot_ripe(uid uuid, p public.plots, p_today date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (public._plot_harvest(uid, p, p_today) ->> 'ripe')::boolean
$$;

create or replace function public.harvest_plot(p_slot text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  p public.plots;
  day date;
  regrow boolean;
  h jsonb;
  item text;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into p from public.plots where user_id = uid and slot = p_slot for update;
  if not found or p.crop_id is null then
    raise exception 'nothing to harvest' using errcode = 'P0002';
  end if;
  day := public._wake_day(uid);
  h := public._plot_harvest(uid, p, day);
  if not (h ->> 'ripe')::boolean then
    raise exception 'not ripe yet' using errcode = '22023';
  end if;
  regrow := public._crop_regrows(p.crop_id);
  if regrow then
    update public.plots set harvested_on = day, state = 'growing' where id = p.id;
  else
    update public.plots
    set crop_id = null, planted_on = null, harvested_on = null, growth_days = 0, quality = 'normal',
        mutations = '{}', weeds = false, wilt_level = 0, state = 'empty'
    where id = p.id;
  end if;
  item := 'crop:' || p.crop_id || ':' || (h ->> 'quality') || ':'
          || round((h ->> 'mult')::numeric * 100)::integer;
  insert into public.inventory (user_id, item_id, qty)
  values (uid, item, 1)
  on conflict (user_id, item_id) do update set qty = public.inventory.qty + 1;
  insert into public.events (user_id, type, payload)
  values (uid, 'harvest', jsonb_build_object('slot', p_slot, 'crop', p.crop_id, 'date', day, 'regrow', regrow,
                                             'quality', h ->> 'quality', 'mult', (h ->> 'mult')::numeric));
  return jsonb_build_object('crop', p.crop_id, 'regrow', regrow, 'date', day,
                            'quality', h ->> 'quality', 'mult', (h ->> 'mult')::numeric, 'item', item);
end $$;

revoke all on function public._earned_mutations(uuid, date) from public, anon, authenticated;
revoke all on function public._mutation_multiplier(text[]) from public, anon, authenticated;
revoke all on function public._plot_harvest(uuid, public.plots, date) from public, anon, authenticated;
revoke all on function public.harvest_plot(text) from public, anon;
grant execute on function public.harvest_plot(text) to authenticated;
