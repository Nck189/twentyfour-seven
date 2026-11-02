# DECISIONS — judgment calls made during the build

Format: date · decision · why · how to change it

- 2026-11-02 · Next.js 16.4 with its default `cacheComponents: true` kept · it's the scaffold default, and a static app shell gives a fast PWA · set `cacheComponents: false` in `next.config.ts`.
- 2026-11-02 · App screens are client components that read/write Supabase directly via the browser client; RLS is the security boundary; economy changes go only through `security definer` RPCs · fits a static PWA shell, enables optimistic UI and offline handling, and avoids blocking server renders on cookies · move reads into Server Components behind `<Suspense>` if SSR data is ever needed.
- 2026-11-02 · next-intl used in client mode (`NextIntlClientProvider`), locale stored in localStorage + `profiles.locale` (synced across devices after login) · no locale in the URL; works with the static shell · switch to next-intl routing (`app/[locale]`) if public SEO pages are ever needed.
- 2026-11-02 · Vercel CLI runs via `npx vercel` · global npm install failed with a permissions error and fixing it needs sudo · `brew install --cask vercel` or fix npm prefix.
- 2026-11-02 · Auth: email magic link only for now; Google OAuth deferred to M14 (per START_HERE) · Google needs Google Cloud console setup · add provider in Supabase + button flag `NEXT_PUBLIC_GOOGLE_AUTH=1`.
- 2026-11-02 · Keep-alive: Vercel daily cron calls `/api/keepalive`, which runs a tiny DB RPC · Hobby plan allows 1 cron/day; a DB query counts as activity · change schedule in `vercel.json`.
- 2026-11-02 · Login email contains both a magic link AND a 6-digit code; the login screen accepts the code · on iOS, the home-screen PWA and Safari have separate storage, so a magic link opened from Mail signs in Safari, not the installed app (iOS restriction) · remove the code step in `app/login` and the template in `supabase/templates/` if iOS ever shares sessions.
- 2026-11-02 · G6 "Lighthouse PWA ≥ 90" is checked by `tests/e2e/pwa.spec.ts` (manifest, icons, service worker, apple-touch-icon) instead of a Lighthouse score · Lighthouse 12+ removed the PWA category, so the score no longer exists · re-add if Lighthouse brings it back.
- 2026-11-02 · Fixed test clock is 2026-10-28 10:00 Bangkok (a Wednesday), in the past · Supabase JWTs are issued at real time; a future fake clock makes the client think tokens expired · change `tests/helpers/clock.ts`.
- 2026-11-02 · Playwright pinned to 1.61.1 · this Mac runs macOS 14, where Playwright only ships a frozen WebKit build; 1.62+ sends a WebKit setting that build doesn't know, so every WebKit test crashes · unpin after upgrading macOS (CI on Ubuntu is unaffected).
