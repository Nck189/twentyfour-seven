# M12 share links — one-time setup (Minnie)

The share page (`/share/<secret>`) computes free/busy **on the server**, so it needs the Supabase
service-role key as a server-only env var on Vercel. Without it every share link shows "not found"
(nothing else in the app changes).

1. Supabase dashboard → Project Settings → API → copy the **service_role** key (secret).
2. Vercel → twentyfour-seven → Settings → Environment Variables → add
   `SUPABASE_SERVICE_ROLE_KEY` = that key, for **Production** (and Preview if you use previews).
   Never prefix it with `NEXT_PUBLIC_`, never paste it in chat or commit it.
3. Run the migration from `main` after the PR merges: `npx supabase db push --remote`.
4. Redeploy (Vercel → Deployments → Redeploy) so the new env var is picked up.
5. Check: More → Share my free times → Get my link → open it in a private window: you see free
   times, and sending a request shows "Sent!".

Locally and in CI the key comes from `supabase status` (already exported as `SUPABASE_SERVICE_ROLE_KEY`).
