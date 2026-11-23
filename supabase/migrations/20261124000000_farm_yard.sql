-- Farm yard (Minnie 2026-11-23, docs/FARM_YARD_PLAN.md): decor has a place on the farm. A row has a
-- spot (1–8) or none (in storage); nothing is ever deleted. New decor (bought, earned, a story
-- gift) takes the first free spot, or goes to storage when the yard is full. Moving and putting
-- away are server-side; users can't write the spot directly (their column grant is x, y only).

alter table public.decor add column if not exists spot smallint check (spot between 1 and 8);
create unique index if not exists decor_user_spot on public.decor (user_id, spot) where spot is not null;

-- Existing decor: spots 1–8 in the order it was bought; the rest waits in storage.
with ranked as (
  select id, row_number() over (partition by user_id order by created_at, id) as n from public.decor
)
update public.decor d set spot = r.n from ranked r where d.id = r.id and r.n <= 8 and d.spot is null;

create or replace function public._decor_first_spot(uid uuid)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select min(s)::smallint from generate_series(1, 8) s
  where not exists (select 1 from public.decor d where d.user_id = uid and d.spot = s)
$$;

create or replace function public._decor_place_new()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.spot is null then
    new.spot := public._decor_first_spot(new.user_id);
  end if;
  return new;
end $$;

drop trigger if exists decor_place_new on public.decor;
create trigger decor_place_new before insert on public.decor
for each row execute function public._decor_place_new();

-- Place an item (from the yard or storage) on a spot. If another item is there, the two swap:
-- it goes where this one was (storage, if this one came from storage).
create or replace function public.place_decor(p_id uuid, p_spot integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  item public.decor;
  other public.decor;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_spot is null or p_spot < 1 or p_spot > 8 then
    raise exception 'bad spot' using errcode = '22023';
  end if;
  -- Serialize this user's yard edits (two quick drags).
  perform 1 from public.game_state where user_id = uid for update;
  select * into item from public.decor where id = p_id and user_id = uid for update;
  if not found then
    raise exception 'not yours' using errcode = 'P0001';
  end if;
  if item.spot = p_spot then
    return jsonb_build_object('id', item.id, 'spot', item.spot);
  end if;
  select * into other from public.decor where user_id = uid and spot = p_spot for update;
  update public.decor set spot = null where id = item.id;
  if other.id is not null then
    update public.decor set spot = item.spot where id = other.id;
  end if;
  update public.decor set spot = p_spot where id = item.id;
  insert into public.events (user_id, type, payload)
  values (uid, 'decor_placed', jsonb_build_object('item', item.item_id, 'from', item.spot, 'to', p_spot,
                                                  'swapped', other.item_id));
  return jsonb_build_object('id', item.id, 'spot', p_spot, 'swapped', other.id);
end $$;

create or replace function public.store_decor(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  item public.decor;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into item from public.decor where id = p_id and user_id = uid for update;
  if not found then
    raise exception 'not yours' using errcode = 'P0001';
  end if;
  update public.decor set spot = null where id = item.id;
  insert into public.events (user_id, type, payload)
  values (uid, 'decor_stored', jsonb_build_object('item', item.item_id, 'from', item.spot));
  return jsonb_build_object('id', item.id, 'spot', null);
end $$;

revoke all on function public._decor_first_spot(uuid) from public, anon, authenticated;
revoke all on function public._decor_place_new() from public, anon, authenticated;
revoke all on function public.place_decor(uuid, integer) from public, anon;
grant execute on function public.place_decor(uuid, integer) to authenticated;
revoke all on function public.store_decor(uuid) from public, anon;
grant execute on function public.store_decor(uuid) to authenticated;

-- A festival set in the yard (this month's festival item + 2 more placed) brings a short Som scene,
-- once, no gift (story beat yard_festival; mirrors content/story.ts). Same functions as
-- 20261123000000_milestone_beats.sql plus the new fact and beat.
create or replace function public._story_facts(uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with tz as (
    select coalesce((select p.timezone from public.profiles p where p.user_id = uid), 'Asia/Bangkok') as name
  ), uses as (
    select split_part(e.payload ->> 'item', ':', 2) as crop, e.at from public.events e
    where e.user_id = uid and e.type = 'produce_sold'
    union all
    select e.payload ->> 'crop', e.at from public.events e
    where e.user_id = uid and e.type in ('order_delivered', 'seasonal_order_delivered')
  )
  select jsonb_build_object(
    'harvests', (select count(*) from public.events e where e.user_id = uid and e.type = 'harvest'),
    'good_days', (select count(*) from public.day_results d
                  where d.user_id = uid and d.kind in ('perfect', 'minimum')),
    'day', public._season_day(uid),
    'season_uses', coalesce((select jsonb_agg(distinct u.crop || ':'
                                              || public._season_year(u.crop, (u.at at time zone tz.name)::date))
                             from uses u, tz
                             where public._season_month(u.crop) is not null), '[]'::jsonb),
    'hatched', (select count(*) from public.animals a where a.user_id = uid),
    'best_streak', coalesce((select g.best_streak from public.game_state g where g.user_id = uid), 0),
    -- Days the app was used, not a streak: live "I'm up" presses since the account was made (G7
    -- R2-1: filled-in days and days before sign-up never count; backfill reaches 30 days back).
    'days_used', (select count(distinct w.date) from public.wake_events w, tz
                  where w.user_id = uid and not w.backfilled
                    and w.date >= coalesce((select (p.created_at at time zone tz.name)::date
                                            from public.profiles p where p.user_id = uid), w.date)),
    'house', public._upgrade_level(uid, 'house'),
    -- Review fix F5 (milestone scenes): perfect days, factory batches collected, welcome backs.
    'perfect_days', (select count(*) from public.day_results d where d.user_id = uid and d.kind = 'perfect'),
    'made', (select count(*) from public.events e where e.user_id = uid and e.type = 'jobs_collected'),
    -- Only a welcome back in the last 7 days: an old one (before this scene existed) stays old.
    'welcome_backs', (select count(*) from public.ticket_grants g
                      where g.user_id = uid and g.reason = 'welcome_back'
                        and g.ref_date > public._season_day(uid) - 7),
    -- Farm yard: this month's festival item placed, with 2+ other items in the yard.
    'festival_set', (exists (select 1 from public.decor d
                             where d.user_id = uid and d.spot is not null
                               and public._festival_month(d.item_id)
                                   = extract(month from public._wake_day(uid))::integer)
                     and (select count(*) from public.decor d where d.user_id = uid and d.spot is not null) >= 3)
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
  d date := (f ->> 'day')::date;
  crop text := public._story_season_crop(p_beat);
begin
  return case p_beat
    when 'ch0_gate' then true
    when 'ch1_first_harvest' then (f ->> 'harvests')::integer >= 1
    when 'ch2_watering_can' then (f ->> 'good_days')::integer >= 3
    when 'ch3_new_friend' then (f ->> 'hatched')::integer >= 1
    when 'ch4_sunset' then (f ->> 'best_streak')::integer >= 7
    when 'ch5_house' then (f ->> 'house')::integer >= 1
    when 'ch6_album' then (f ->> 'days_used')::integer >= 30
    when 'cafe_open' then (f ->> 'house')::integer >= 2
    when 'ch7_perfect_day' then (f ->> 'perfect_days')::integer >= 1
    when 'ch8_thirty_days' then (f ->> 'best_streak')::integer >= 30
    when 'ch10_first_batch' then (f ->> 'made')::integer >= 1
    when 'ch11_welcome_back' then (f ->> 'welcome_backs')::integer >= 1
    when 'yard_festival' then (f ->> 'festival_set')::boolean
    when 'lotus_open' then extract(month from d)::integer = public._season_month(crop)
    when 'lotus_market' then extract(month from d)::integer = public._season_month(crop)
                             and extract(day from d) >= 15
    when 'lotus_use' then (f -> 'season_uses') ? (crop || ':' || public._season_year(crop, d))
    when 'snow_open' then extract(month from d)::integer = public._season_month(crop)
    when 'snow_market' then extract(month from d)::integer = public._season_month(crop)
                            and extract(day from d) >= 15
    when 'snow_use' then (f -> 'season_uses') ? (crop || ':' || public._season_year(crop, d))
  end;
end $$;
