# PROGRESS — 24/7

## Current milestone
**M0** — scaffold, auth, PWA shell, deploy. Code done + local QC green; **waiting on deploy steps**.

M0 plan:
1. Next.js 16.4 scaffold, tokens + fonts, next-intl (client provider, EN/TH), Supabase SSR auth (email link + 6-digit code; Google deferred to M14).
2. App shell: phone bottom tabs, iPad/Mac split view; PWA manifest + service worker + flat SVG icons.
3. Keep-alive: Vercel daily cron → `/api/keepalive` → `public.keepalive()` RPC.
4. QC toolchain: Vitest, Playwright 6-project matrix (WebKit), fixed clock, axe, touch-target helper, visual baselines, i18n check, art lint, secrets check, LHCI, `npm run qc` / `qc:prod`, GitHub Actions.
5. Journeys: CJ-01 (login), CJ-14 (language toggle). Invariants: time helpers (midnight, month end, leap day, tz-agnostic).

## Done
- Phase 0 tools: Node 24, git, gh (logged in as Nck189), Supabase CLI 2.122, Vercel CLI via `npx vercel` (logged in), Docker running, local Supabase (`supabase start`) up.
- M0 code complete, committed locally (`48f0d7b`).
- Local QC: G1 ✅ (tsc, eslint strict+jsx-a11y, prettier, i18n 61 keys, art lint) · G2 ✅ unit 7/7, e2e 106/106 across 6 projects, coverage 84% · G3 visual matrix 120 screenshots reviewed; fixed iPad rail logo clipping + Thai tab label touching icon · G4 ✅ axe 0 serious, touch targets ≥44 on all screens EN/TH light/dark (fixed primary/accent contrast) · G5 ✅ secrets check.

## Next concrete step
1. Push to GitHub (`gh repo create twentyfour-seven --private --source . --push`) — was blocked by the permission classifier; needs Minnie to approve.
2. After `supabase login`: `supabase projects create twentyfour-seven --region ap-southeast-1 --org-id <id> --db-password <gen>` → save `SUPABASE_DB_PASSWORD` + prod keys in `.env.local` (as `PROD_*`) → `supabase link` → `supabase db push` → `supabase config push` (auth URLs + email template).
3. `npx vercel link` → connect Git → `vercel env add` (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, CRON_SECRET) for prod/preview/dev → deploy.
4. G6 `npm run qc:prod`, G7 reviewer subagent, write `docs/qa/M0-report.md`, then start M1 (schema + RLS + seed + export).

## Blockers
- `supabase login` not done yet (needs Minnie, separate Terminal tab; CLI refuses non-TTY).
- Creating/pushing the private GitHub repo was denied by the auto-mode permission check → Minnie must approve or allow `gh repo create` / `git push`.

## Notes
- Local dev uses local Supabase (`.env.local` points to 127.0.0.1:54321). Visual baselines are macOS-WebKit, so CI runs functional e2e only.
- Playwright pinned to 1.61.1 (macOS 14 frozen WebKit) — see DECISIONS.

## URLs
- Prod: (pending)
- GitHub: (pending)
- Supabase: (pending)
