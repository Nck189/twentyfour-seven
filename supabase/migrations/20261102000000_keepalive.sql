-- Keep-alive RPC: called daily by Vercel cron so the free Supabase project never pauses.
create or replace function public.keepalive()
returns timestamptz
language sql
stable
as $$ select now() $$;

grant execute on function public.keepalive() to anon, authenticated;
