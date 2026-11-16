-- M14 / G15 (Minnie OK 2026-11-16): a signed-in user can delete their own account. Deleting the
-- auth user cascades to every table that references it (each user table has
-- `references auth.users on delete cascade`; tests/integration/delete-account.test.ts checks every
-- exported table is empty afterwards).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  delete from auth.users where id = uid;
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
