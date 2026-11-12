-- Apply as a superuser (local: -U supabase_admin). Playtest harness, LOCAL ONLY (docs/PLAYTEST_PLAN.md). Never put this in supabase/migrations/.
-- The server uses now(), so a simulated day passes by moving one user's whole history back,
-- and the time of day moves by changing that user's timezone. Triggers are bypassed here
-- (session_replication_role = replica) because the harness, not a player, is moving things.
create schema if not exists qa;

-- Moves one user's whole history: date labels by `days` and every timestamp by `mins` minutes
-- (negative = into the past). Together with a timezone change this lets simulated time pass:
-- the harness keeps every past event at the same local date and time while "now" moves on.
create or replace function qa.shift_user(uid uuid, days integer, mins integer)
returns void
language plpgsql
as $$
declare
  r record;
  far constant integer := 100000; -- two-phase move: no (user, date) key collides mid-update
begin
  perform set_config('session_replication_role', 'replica', true);
  for r in
    select c.table_name, c.column_name, c.data_type
    from information_schema.columns c
    join information_schema.columns u
      on u.table_schema = c.table_schema and u.table_name = c.table_name and u.column_name = 'user_id'
    where c.table_schema = 'public'
      and c.data_type in ('date', 'timestamp with time zone')
      -- A review's week must stay a Monday (check constraint); the week label is left alone.
      and not (c.table_name = 'weekly_reviews' and c.column_name = 'week_start')
  loop
    if r.data_type = 'date' then
      if days <> 0 then
        execute format('update public.%I set %I = %I - $1 where user_id = $2 and %I is not null',
                       r.table_name, r.column_name, r.column_name, r.column_name) using far, uid;
        execute format('update public.%I set %I = %I + $1 where user_id = $2 and %I is not null',
                       r.table_name, r.column_name, r.column_name, r.column_name) using far + days, uid;
      end if;
    elsif mins <> 0 then
      execute format('update public.%I set %I = %I + make_interval(mins => $1) where user_id = $2 and %I is not null',
                     r.table_name, r.column_name, r.column_name, r.column_name) using mins, uid;
    end if;
  end loop;
  if days <> 0 then
    -- Dates kept inside event payloads (Stats read the Night ritual's date from them).
    update public.events
       set payload = jsonb_set(payload, '{date}', to_jsonb(((payload->>'date')::date + days)::text))
     where user_id = uid and payload ? 'date' and (payload->>'date') ~ '^\d{4}-\d{2}-\d{2}$';
  end if;
  -- The account is as old as its history.
  update auth.users set created_at = created_at + make_interval(mins => mins) where id = uid;
end $$;
drop function if exists qa.shift_user(uuid, integer);

-- Sets the profile timezone directly (the in-app guard is for players, not the harness).
create or replace function qa.set_tz(uid uuid, tz text)
returns void
language plpgsql
as $$
begin
  perform set_config('session_replication_role', 'replica', true);
  update public.profiles set timezone = tz where user_id = uid;
end $$;
