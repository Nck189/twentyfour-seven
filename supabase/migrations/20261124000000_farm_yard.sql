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
