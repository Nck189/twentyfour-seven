# PROGRESS — 24/7

## Current milestone
**Phase 0 + M0** — scaffold, auth, PWA shell, deploy.

M0 plan:
1. Next.js 16.4 scaffold (done), tokens + fonts, next-intl (client provider, EN/TH), Supabase SSR auth (magic link; Google deferred to M14).
2. App shell: phone bottom tabs (Today · Plan · Farm · Stats · More), iPad/Mac split view; PWA manifest + service worker + flat SVG icons.
3. Keep-alive: Vercel daily cron → `/api/keepalive` → `public.keepalive()` RPC.
4. QC toolchain: Vitest, Playwright 6-project matrix (WebKit), fixed clock, axe, touch-target helper, visual baselines, i18n key check, LHCI, `npm run qc` / `qc:prod`, GitHub Actions.
5. Journeys touched: CJ-01 (login), CJ-14 (language toggle). Invariants: none yet (engine/game start M2/M6).

## Done
- Phase 0: Node 24, git, gh (logged in as Nck189), Supabase CLI 2.122 (brew), Vercel CLI via `npx vercel` (npm -g blocked by permissions), Vercel login ✅.
- Next.js scaffold moved into project root; deps installed; Playwright WebKit + Chromium installed.

## Next concrete step
- Finish M0 shell files → `git init` + GitHub repo → Supabase project create (needs `supabase login`) → Vercel link + env → deploy.

## Blockers
- `supabase login` must be done by Minnie in a separate Terminal tab (CLI refuses non-TTY).

## URLs
- Prod: (pending)
- GitHub: (pending)
- Supabase: (pending)
