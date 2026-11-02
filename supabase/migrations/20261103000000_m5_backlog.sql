-- M5 Backlog: finishing an item grants coins (SPEC §8.1: Must > Should > Just start).
-- Coins only change here, server-side, once per item: a read-only ledger blocks repeats
-- (done → reopen → done again earns nothing).

create table public.coin_grants (
  user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('backlog_done')),
  ref text not null,
  amount integer not null check (amount > 0),
  at timestamptz not null default now(),
  primary key (user_id, reason, ref)
);
alter table public.coin_grants enable row level security;
alter table public.coin_grants force row level security;
create policy "own rows: select" on public.coin_grants for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.coin_grants from anon;

-- Marks the item done and grants its coins the first time. Returns { coins_granted }.
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
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into item from public.backlog_items where id = p_id and user_id = uid for update;
  if not found then
    raise exception 'backlog item not found' using errcode = 'P0002';
  end if;
  update public.backlog_items
     set status = 'done', done_at = coalesce(done_at, now())
   where id = p_id;

  -- Mirrors content/economy.ts COINS_BY_PRIORITY (checked by tests/integration/backlog.test.ts).
  amount := case item.priority when 'must' then 30 when 'should' then 20 else 10 end;
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
