-- Atomic checklist toggle: two devices ticking different items can't overwrite each other (CJ-15).
create or replace function public.set_block_item(
  p_date date,
  p_block text,
  p_item text,
  p_done boolean,
  p_planned_start timestamptz,
  p_items_planned smallint
)
returns public.block_logs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  row public.block_logs;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  insert into public.block_logs (user_id, date, block, planned_start, started_at, items_done, items_planned)
  values (
    uid, p_date, p_block, p_planned_start, now(),
    case when p_done then jsonb_build_array(p_item) else '[]'::jsonb end,
    p_items_planned
  )
  on conflict (user_id, date, block) do update set
    items_done = case
      when p_done then
        case when public.block_logs.items_done ? p_item then public.block_logs.items_done
             else public.block_logs.items_done || jsonb_build_array(p_item) end
      else public.block_logs.items_done - p_item
    end,
    items_planned = greatest(public.block_logs.items_planned, excluded.items_planned),
    started_at = coalesce(public.block_logs.started_at, excluded.started_at)
  returning * into row;
  return row;
end $$;
revoke all on function public.set_block_item(date, text, text, boolean, timestamptz, smallint) from public, anon;
grant execute on function public.set_block_item(date, text, text, boolean, timestamptz, smallint) to authenticated;

-- Realtime for live sync between devices.
alter publication supabase_realtime add table public.block_logs, public.wake_events, public.day_plans;
