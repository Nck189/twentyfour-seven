# PROGRESS — 24/7

## Current milestone
**M0** waiting on G7 review → then M1 QC (G3–G7) → M2 QC → M3 Today screen.
(M1 schema and M2 engine were built while the M0 reviewer ran.)

## Done
- **Phase 0** ✅ tools + logins (gh, Supabase, Vercel), GitHub repo, Supabase prod project, Vercel auto-deploy from `main`.
- **M0** code + G1–G6 ✅ (report draft: docs/qa/M0-report.md). Pending: G7 reviewer verdict.
- **M1** (built, QC partly): 16 tables + RLS, defaults seeded on sign-up (generated from `content/defaults.ts`), Export JSON + CSV zip, language synced to profile. RLS integration tests 46/46. Migrations applied to prod.
- **M2** (built): `lib/engine` with every SPEC §3 scenario + 8 fast-check invariants, coverage 98.9%.

## Next concrete step
1. Read G7 findings → fix S1/S2 → re-review once → finalize M0 report → ✅ message.
2. M1: G6 on prod (export on prod, seeded defaults for real user), G7, report.
3. M2: report (no UI → G3/G4 n/a), then start M3.

## Blockers
- none

## Notes
- Local dev/tests use local Supabase (`.env.local` NEXT_PUBLIC_* = 127.0.0.1). Prod keys are `PROD_*` in `.env.local`.
- Supabase CLI reads `.env.local` (SUPABASE_DB_PASSWORD) — use `--db-url` for local type gen (`npm run db:types`).
- Playwright pinned 1.61.1 (macOS 14). Visual baselines macOS-only; CI runs functional e2e.
- Prod smoke: `npm run qc:prod` (serial, shared account `smoke-test@twentyfour-seven.invalid`).

## URLs
- Prod: https://twentyfour-seven.vercel.app
- GitHub: https://github.com/Nck189/twentyfour-seven (private)
- Supabase: https://supabase.com/dashboard/project/stxachfrbpcanlqcxmvj (org "Pinto", Singapore, free)
- DB password: `.env.local` → `SUPABASE_DB_PASSWORD`
