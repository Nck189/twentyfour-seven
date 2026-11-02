-- G7 re-review R-M3-4 (S2, CJ-15 for day plans): edits from two devices/screens no longer
-- overwrite each other. Only the fields a client changed are written; per-block overrides are
-- merged block by block, so e.g. Sick mode set on the phone survives a Plan edit on the Mac.
create or replace function public.patch_day_plan(
  p_date date,
  p_set jsonb default '{}'::jsonb,
  p_blocks jsonb default null,
  p_fixed_events jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  s jsonb := coalesce(p_set, '{}'::jsonb);
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if s ? 'template_id' and (s ->> 'template_id') is not null
     and not exists (select 1 from public.templates where id = (s ->> 'template_id')::uuid and user_id = uid) then
    raise exception 'template not found' using errcode = 'P0002';
  end if;
  insert into public.day_plans (user_id, date) values (uid, p_date)
  on conflict (user_id, date) do nothing;
  update public.day_plans d set
    template_id = case when s ? 'template_id' then (s ->> 'template_id')::uuid else d.template_id end,
    attending = case when s ? 'attending' then (s ->> 'attending')::boolean else d.attending end,
    bedtime_override = case when s ? 'bedtime_override'
                            then (s ->> 'bedtime_override')::timestamptz else d.bedtime_override end,
    late_night = case when s ? 'late_night'
                      then nullif(s -> 'late_night', 'null'::jsonb) else d.late_night end,
    mode = case when s ? 'mode' then s ->> 'mode' else d.mode end,
    planned = case when s ? 'planned' then nullif(s -> 'planned', 'null'::jsonb) else d.planned end,
    overrides = d.overrides
      || case when p_blocks is not null
              then jsonb_build_object('blocks', coalesce(d.overrides -> 'blocks', '{}'::jsonb) || p_blocks)
              else '{}'::jsonb end
      || case when p_fixed_events is not null
              then jsonb_build_object('fixed_events', p_fixed_events)
              else '{}'::jsonb end
  where d.user_id = uid and d.date = p_date;
end $$;
revoke all on function public.patch_day_plan(date, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.patch_day_plan(date, jsonb, jsonb, jsonb) to authenticated;
