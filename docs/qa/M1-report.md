# QC Report — M1: Database schema + RLS + seed defaults + export
Date: 2026-11-03 · Branch: PR #5 (`claude/practical-cannon-a70ubq`) · Prod URL: https://twentyfour-seven.vercel.app

## Gate results
| Gate | Result | Evidence |
|---|---|---|
| G1 Static | ✅ | tsc 0 · eslint (max-warnings 0) 0 · prettier clean · i18n 0 missing (389 keys) · art lint 0 · no emoji (unit guard) — CI QC #66/#67 |
| G2 Functional | ✅ | unit 152 · integration: RLS cross-user (every export table), seed defaults, export, review-m123, wake-freeze, day-plan-patch, backlog, night · E2E CJ-02 seeded defaults, CJ-17 export (JSON + CSV zip) on 6 projects · coverage (logic) 98% lines / 91% branches |
| G3 Visual QC | ✅ | M1 UI = Settings → Export card only; covered by the shell sweep (every screen, EN/TH, light/dark) · art lint 0 |
| G4 UX QC | ✅ | shell G4 sweep: axe serious/critical 0, controls ≥ 44 px, no horizontal scroll (EN/TH, light/dark) |
| G5 Data & security | ✅ | RLS on every table, user A can't read/write B (integration) · ledgers read-only · wake events immutable (R-M1-4 fixed) · server-only event types blocked (M1-F3) · secrets check clean |
| G6 Production smoke | ✅ | `npm run qc:prod` 22/22 on prod (2026-11-03 00:45, incl. CJ-17 export) · Lighthouse assertions passed |
| G7 Independent review | ⏳ | review 1 (local, M1–M3): M1-F1..F4 fixed · re-review 2026-11-03 (`G7-M1-M3.md`): no M1 S1/S2; R-M1-4 fixed with the S1 wake work · re-review of fixes: see below |

## Issues found & fixed
| ID | Sev | Found by | Description | Regression test | Fixed in |
|---|---|---|---|---|---|
| M1-F1 | S2 | G7 | Plots writable by clients | review-m123 | 20261102060000 |
| M1-F2 | S3 | G7 | Export order not stable | export unit test | lib/export |
| M1-F3 | S2 | G7 | Server-only event types insertable | review-m123 | 20261102060000 |
| M1-F4 | S3 | G7 | CSV formula injection (=,+,-,@) | csv unit test | lib/export/csv |
| R-M1-4 | S3 | G7 re-review | Wake events deletable (enabled re-press) | wake-freeze "can't be deleted" | 20261103010000 |

## Known issues (S3/S4 only)
| ID | Sev | Description | Plan |
|---|---|---|---|
| R-M1-1 | S3 | Export leaves out `coin_grants` (and the RLS loop iterates export tables) | next small fix |
| R-M1-2 | S3 | Generated DB types are stale and unused (rows are cast) | regenerate + use in M6 |
| R-M1-3 | S3 | `events.at` client-writable; server-only types are a blocklist | allowlist + server time in M10 (analytics) |
| R-M1-5 | S4 | `profiles.timezone` not validated | check against pg_timezone_names |
| R-M1-6 | S4 | Family Saturday defaults not logged in DECISIONS | log |
| R-M1-7 | S4 | Export filename date uses the default zone | use profile tz |
