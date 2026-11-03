# QC Report — M3: Today screen + check-ins
Date: 2026-11-03 · Branch: PR #5 · Prod URL: https://twentyfour-seven.vercel.app

## Gate results
| Gate | Result | Evidence |
|---|---|---|
| G1 Static | ✅ | tsc 0 · eslint (max-warnings 0) 0 · prettier clean · i18n 0 missing (389 keys) · art lint 0 · no emoji (unit guard) — CI QC #66/#67 |
| G2 Functional | ✅ | unit: today (timeline, wake-day, wake card, plannedWake, drift, missing kind), block-status, sheet (focus), foreground · integration: wake (CJ-03/04/06), wake-freeze (S1 cheats + planned push), review-m123 · E2E CJ-03..06, CJ-14..16, regressions-m3 on 6 projects · CJ-15 stress 0/576 failures (2026-11-02) |
| G3 Visual QC | ⏳ | Today was redesigned ("one thing at a time"): the macOS visual baselines in `tests/visual` are stale and must be re-recorded on the Mac (`npm run e2e:update`) with a rubric pass — the cloud can't run them |
| G4 UX QC | ✅ | CJ-05 check-in = 5 taps (first-10 also starts the block); "I'm up" 1 tap from launch; axe 0 serious; targets ≥ 44 px |
| G5 Data & security | ✅ | Sunrise ticket server-side with a frozen target (anti-cheat) and planned pushes honored; backfill never earns; wake events immutable |
| G6 Production smoke | ✅ (pre-fix) | prod 22/22 on 2026-11-03 00:45; re-run after PR #5 + `db push --remote` |
| G7 Independent review | ✅ | review 1 → fixes → re-review 1 FAIL → fixes → re-review 2 (no S1) → fixes → **re-review 3 PASS** (`G7-rereview-3-2026-11-03.md`, head a1f4f90): no open S1/S2; R4-1..3 S3 + S4s logged below |

## Issues found & fixed (since review 1; earlier M3-F* list in PROGRESS)
| ID | Sev | Found by | Description | Regression test | Fixed in |
|---|---|---|---|---|---|
| R-M3-1 | S1 | G7 re-review | Sunrise target movable after the fact (template/day plan/window/timezone edit, delete + re-press) | integration wake-freeze | 20261103010000 |
| R-M3-2 | S1 | G7 re-review | Planned bedtime push / out late ignored by the server target | wake-freeze "push planned the night before"; unit plannedWake | 20261103010000 + usePlan |
| R-M3-3 | S2 | G7 re-review | Missed blocks shown as Backfilled/Done | unit block-status | Timeline |
| R-M3-4 | S2 | G7 re-review | Day-plan edits from two devices overwrote each other; Today deaf to day-plan changes | unit plan-patch, integration day-plan-patch | 20261103030000 + lib/plan/patch + realtime |
| CJ-15 | S2 | CI | Dropped taps after a quick app switch | regressions-m3 + stress 0/576 | lib/today/foreground |
| T-M3-1 | S3 (test) | CI (QC on b236fee, 07:03 BKK Tue) | M3-F1 test set its template as the client, so the freeze (correctly) kept the 10:00 default and 07:03 fell in its early window; time-of-day flake, product behaviour correct | review-m123 M3-F1 now sets up as admin + drops the snapshot | a1f4f90 |

## Known issues (S3/S4 only)
| ID | Sev | Description | Plan |
|---|---|---|---|
| R-M3-5 | S3 | Offline check-in synced > 10 min later becomes backfilled | M14 offline queue with original timestamps |
| R-M3-6/7 | S3 | Field-level conflicts inside one block across devices (start time, mood) | M14 |
| R-M3-8 | S3 | After a tab switch Today can run on an old clock up to 30 s | fix useNow resubscribe |
| R-M3-9 | S3 | "Nothing was lost" while the retry queue is memory-only | M14 persistent queue |
| R-M3-10/11 | S3 | Does "I'm up" start the day? Vacation as a date range? | questions for Minnie |
| R-M3-12/13 | S3 | Long own first-10 text overflow; sub-slot labels clipped | polish |
| R-M3-14 | S3 | block_logs fields client-written (on-time, items) — must not feed M7 rewards as is | M7 design |
| R-M3-15..19 | S4 | symmetric on-time label, double celebration, burst > 2.5 s on re-render, "Fixed" label, events fire-and-forget | polish |
| R4-1 | S3 | Today and the server can still disagree on the Sunrise target in narrow cases (kind moved after a flight day was planned; bedtime push then sleep length change; a pull > 6 h) — target computed in two places | one server target that Today shows (M7, before rewards grow) |
| R4-3 | S3 | A few integration tests skip certain local hours (midnight edges) | run them at a fixed clock (fake now) |
| M3-K1 | S4 | Linux WebKit "internal error" on page.goto in CI (test infra) | retries; Mac runs are clean |
