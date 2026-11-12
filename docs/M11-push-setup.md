# M11 push notifications — one-time setup (Minnie, on the Mac)

The code ships with notifications **off** ("coming soon" in More) until these steps are done.
Nothing here goes into git: the keys live in Supabase function secrets and Vercel env.

1. **Make the VAPID keys** (once):
   ```bash
   npx web-push generate-vapid-keys
   ```
2. **Supabase function secrets** (replace the placeholders with your two keys and your email):
   ```bash
   npx supabase secrets set VAPID_PUBLIC_KEY=<public key> VAPID_PRIVATE_KEY=<private key> VAPID_SUBJECT=mailto:<your email>
   ```
3. **Deploy the sender:**
   ```bash
   npx supabase functions deploy push-send
   ```
4. **Vercel env** (Production + Preview): `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = the **public** key, then redeploy.
5. **Every-minute schedule** (Supabase dashboard → SQL editor, once). It stores the project URL and the
   service-role key in Vault and calls the sender each minute:
   ```sql
   create extension if not exists pg_net;
   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
   select vault.create_secret('<service_role key>', 'service_role_key');
   select cron.schedule('push-send', '* * * * *', $$
     select net.http_post(
       url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/push-send',
       headers := jsonb_build_object(
         'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
         'Content-Type', 'application/json'),
       body := '{}'::jsonb)
   $$);
   ```
6. **Try it:** on the iPhone, open 24/7 **from the Home Screen** (iOS 16.4+), More → Notifications →
   Turn on, then open Today once (it uploads the day's reminders).

How it works: Today plans the day's reminders in your language and uploads them; every minute the
sender sends what's due and skips what no longer applies (block already started, "I'm up" already
pressed, Night ritual done, a switch turned off, quiet hours). Every push shows a notification.
