-- M11 calendar feed (.ics). A secret link per user (More → Calendar); anyone with the link can
-- read the next two weeks of planned blocks and fixed events, nothing else. Anonymous access only
-- through this token-checked RPC (CLAUDE.md). Making a new link stops the old one.

alter table public.profiles add column if not exists ics_token text unique
  check (ics_token is null or ics_token ~ '^[0-9a-f]{48}$');

-- The user's own link (created on first use; p_rotate = a new one, the old one stops working).
create or replace function public.ics_link(p_rotate boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  tok text;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select p.ics_token into tok from public.profiles p where p.user_id = uid;
  if tok is null or p_rotate then
    tok := encode(extensions.gen_random_bytes(24), 'hex');
    update public.profiles set ics_token = tok where user_id = uid;
  end if;
  return tok;
end $$;

-- What the engine needs to plan the next two weeks, for a valid link only (null otherwise).
create or replace function public.ics_context(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid;
  tz text;
  loc text;
  today date;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{48}$' then
    return null;
  end if;
  select p.user_id, p.timezone, p.locale into uid, tz, loc from public.profiles p where p.ics_token = p_token;
  if uid is null then
    return null;
  end if;
  today := (now() at time zone coalesce(tz, 'Asia/Bangkok'))::date;
  return jsonb_build_object(
    'timezone', coalesce(tz, 'Asia/Bangkok'),
    'locale', loc,
    'settings', (select jsonb_build_object('blocks', s.blocks, 'gym_close_time', s.gym_close_time)
                 from public.settings s where s.user_id = uid),
    'templates', coalesce((select jsonb_agg(to_jsonb(t) - 'user_id' order by t.sort)
                           from public.templates t where t.user_id = uid), '[]'::jsonb),
    'day_plans', coalesce((select jsonb_agg(jsonb_build_object(
                             'date', d.date, 'template_id', d.template_id, 'attending', d.attending,
                             'bedtime_override', d.bedtime_override, 'late_night', d.late_night,
                             'mode', d.mode, 'overrides', d.overrides))
                           from public.day_plans d
                           where d.user_id = uid and d.date between today - 2 and today + 15), '[]'::jsonb)
  );
end $$;

revoke all on function public.ics_link(boolean) from public, anon;
grant execute on function public.ics_link(boolean) to authenticated;
revoke all on function public.ics_context(text) from public;
grant execute on function public.ics_context(text) to anon, authenticated;
