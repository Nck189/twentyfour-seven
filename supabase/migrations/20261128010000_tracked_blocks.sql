-- Rule B (Minnie OK 2026-11-27, docs/DECISIONS.md): a person chooses which optional blocks to track.
-- The choice is DATED: settings.blocks[].tracked_log = [{from: 'YYYY-MM-DD', tracked: bool}], and a
-- day reads the last entry on or before it (none = tracked; Wake, Down Time and Sleep always are).
-- A change takes effect from the next wake-day (a brand-new account: today), so it never rewrites
-- a past day's Day score or a crop's growth (G7 B S2-3), and only `set_block_tracked` may write the
-- log (a trigger keeps it on every other settings write, so a stale copy can't undo it).
-- An untracked block is left out of the Day score (`_day_oee`), so it can't drag a Perfect day
-- (+1 ticket) or the rainbow weather down, and its plot grows on every kept day instead, at normal
-- quality (`_plot_harvest`). Mirrors lib/game (`trackedOn`, `dayOee`, `simulatePlot`).

-- Is block k untracked on day d for this user?
create or replace function public._untracked_on(uid uuid, k text, d date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select k not in ('wake', 'down', 'sleep') and coalesce((
    select not (x ->> 'tracked')::boolean
    from public.settings s, jsonb_array_elements(s.blocks) e,
         jsonb_array_elements(coalesce(e -> 'tracked_log', '[]'::jsonb)) x
    where s.user_id = uid and e ->> 'key' = k and (x ->> 'from')::date <= d
    order by (x ->> 'from')::date desc
    limit 1), false)
$$;
revoke all on function public._untracked_on(uuid, text, date) from public, anon, authenticated;

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
    -- A block this person didn't track that day is out of the Day score (lib/game dayOee, rule B).
    if public._untracked_on(uid, k, d) then
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
    -- Rule B: a plot whose block wasn't tracked that day grows on every kept day (simulatePlot).
    if r <> 'success' and d < p_today and public._untracked_on(uid, p.slot, d) and coalesce(md, 'normal') = 'normal'
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

-- Track a block or not, from the next wake-day (from today while the account is under a day old,
-- i.e. during setup). Same-day changes replace each other. Returns the new blocks.
create or replace function public.set_block_tracked(p_block text, p_tracked boolean, p_now boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  made timestamptz;
  eff date;
  out_ jsonb;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_block not in ('focus', 'work', 'gradation', 'free') then
    raise exception 'this block is always tracked' using errcode = '22023';
  end if;
  select created_at into made from public.profiles where user_id = uid;
  eff := public._wake_day(uid) + case when p_now and made > now() - interval '1 day' then 0 else 1 end;
  perform set_config('app.tracked_rpc', '1', true);
  update public.settings s
  set blocks = (
    select jsonb_agg(
             case when e ->> 'key' = p_block then
               e || jsonb_build_object('tracked_log',
                 coalesce((select jsonb_agg(x order by (x ->> 'from')::date)
                           from jsonb_array_elements(coalesce(e -> 'tracked_log', '[]'::jsonb)) x
                           where (x ->> 'from')::date < eff), '[]'::jsonb)
                 || jsonb_build_array(jsonb_build_object('from', eff, 'tracked', p_tracked)))
             else e end
             order by ord)
    from jsonb_array_elements(s.blocks) with ordinality t(e, ord))
  where s.user_id = uid
  returning blocks into out_;
  perform set_config('app.tracked_rpc', '', true);
  insert into public.events (user_id, type, payload)
  values (uid, 'block_tracked_set', jsonb_build_object('block', p_block, 'tracked', p_tracked, 'from', eff));
  return out_;
end $$;
revoke all on function public.set_block_tracked(text, boolean, boolean) from public, anon;
grant execute on function public.set_block_tracked(text, boolean, boolean) to authenticated;

-- Every other write keeps each block's tracked_log as it was (a stale copy of the blocks, e.g. Plan's
-- "save as my default" on another device, can't undo or backdate it).
create or replace function public.settings_keep_tracked_log()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('app.tracked_rpc', true) = '1'
     or current_user = 'service_role' or current_setting('role', true) = 'service_role' then
    return new;
  end if;
  new.blocks := (
    select coalesce(jsonb_agg(
             case when o.v -> 'tracked_log' is null then n.v - 'tracked_log'
                  else n.v || jsonb_build_object('tracked_log', o.v -> 'tracked_log') end
             order by n.ord), '[]'::jsonb)
    from jsonb_array_elements(new.blocks) with ordinality as n(v, ord)
    left join lateral (
      select x.v from jsonb_array_elements(old.blocks) as x(v) where x.v ->> 'key' = n.v ->> 'key' limit 1
    ) as o on true);
  return new;
end $$;
drop trigger if exists settings_keep_tracked_log on public.settings;
create trigger settings_keep_tracked_log before update of blocks on public.settings
for each row execute function public.settings_keep_tracked_log();
