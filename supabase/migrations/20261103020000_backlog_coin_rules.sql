-- G7 review R-M5-1 (S2): coins from the backlog come from real work, not from farming.
-- SPEC §0.6 "Rewards only come from real behavior". Mirrors content/economy.ts.
--   * A task finished within 10 min of being added, or of its priority being raised, pays the
--     smallest amount (Just start), so "type x !must + tap" isn't +30.
--   * At most 150 backlog coins per local day.
--   * A removed (dropped) task pays nothing.
-- created_at and priority_set_at are server time (clients can't backdate them).

alter table public.backlog_items add column priority_set_at timestamptz not null default now();

create or replace function public._backlog_server_times()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'service_role' then
    return new; -- admin/test setup may set them
  end if;
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.priority_set_at := now();
  else
    new.created_at := old.created_at;
    new.priority_set_at := case
      when new.priority is distinct from old.priority then now()
      else old.priority_set_at
    end;
  end if;
  return new;
end $$;

create trigger backlog_server_times before insert or update on public.backlog_items
  for each row execute function public._backlog_server_times();

create or replace function public.complete_backlog_item(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  item public.backlog_items;
  amount integer;
  inserted integer;
  tz text;
  day_start timestamptz;
  earned_today integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into item from public.backlog_items where id = p_id and user_id = uid for update;
  if not found then
    raise exception 'backlog item not found' using errcode = 'P0002';
  end if;
  if item.status = 'dropped' then
    return jsonb_build_object('coins_granted', 0);
  end if;
  update public.backlog_items
     set status = 'done', done_at = coalesce(done_at, now())
   where id = p_id;

  amount := case item.priority when 'must' then 30 when 'should' then 20 else 10 end;
  if now() - item.created_at < interval '10 minutes'
     or now() - item.priority_set_at < interval '10 minutes' then
    amount := least(amount, 10);
  end if;

  -- Daily cap (local day of the user).
  select timezone into tz from public.profiles where user_id = uid;
  day_start := ((now() at time zone coalesce(tz, 'Asia/Bangkok'))::date)::timestamp
               at time zone coalesce(tz, 'Asia/Bangkok');
  select coalesce(sum(g.amount), 0) into earned_today
    from public.coin_grants g
   where g.user_id = uid and g.reason = 'backlog_done' and g.at >= day_start;
  amount := least(amount, greatest(0, 150 - earned_today));
  if amount <= 0 then
    return jsonb_build_object('coins_granted', 0, 'capped', true);
  end if;

  insert into public.coin_grants (user_id, reason, ref, amount)
  values (uid, 'backlog_done', p_id::text, amount)
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return jsonb_build_object('coins_granted', 0);
  end if;

  update public.game_state set coins = coins + amount where user_id = uid;
  insert into public.events (user_id, type, payload)
  values (uid, 'coins_granted', jsonb_build_object('amount', amount, 'reason', 'backlog_done', 'item', p_id));
  return jsonb_build_object('coins_granted', amount);
end $$;
revoke all on function public.complete_backlog_item(uuid) from public, anon;
grant execute on function public.complete_backlog_item(uuid) to authenticated;
