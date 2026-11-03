# QC Report — M5: Backlog
Date: 2026-11-03 · Branch: PR #5 · Prod URL: https://twentyfour-seven.vercel.app

## Gate results
| Gate | Result | Evidence |
|---|---|---|
| G1 Static | ✅ | tsc 0 · eslint (max-warnings 0) 0 · prettier clean · i18n 0 missing (389 keys) · art lint 0 · no emoji (unit guard) — CI QC #66/#67 |
| G2 Functional | ✅ | unit backlog (sort, RCCP capacity, carry), capture parser (EN/TH, dates, appointments, leap day) · integration backlog (coins once, anti-farming) · E2E CJ-11 (Move to…, mouse drag), type-once, one-tap finish, day-card finish, capture retry, load errors |
| G3 Visual QC | ⏳ | day card / task rows / month view previews checked (light/dark, no emoji); Mac baselines + rubric still to do |
| G4 UX QC | ✅ | add a task with estimate/priority/day = 1 line + Enter; move = 1 drag or Move to…; targets ≥ 44 px; axe 0 |
| G5 Data & security | ✅ | coins only via `complete_backlog_item` (once per item, 10-min quick-finish, 150/day cap, dropped pays 0, server timestamps) · ledger read-only |
| G6 Production smoke | ✅ (pre-fix) | prod 22/22 2026-11-03; re-run after PR #5 |
| G7 Independent review | ✅ | review 1 → fixes → re-review 1 FAIL → fixes → re-review 2 (no S1) → fixes → **re-review 3 PASS** (`G7-rereview-3-2026-11-03.md`, head a1f4f90): no open S1/S2; R4-1..3 S3 + S4s logged below |

## Issues found & fixed
| ID | Sev | Description | Regression test | Fixed in |
|---|---|---|---|---|
| R-M5-1 | S2 | Coins farmable from the normal UI | integration "coins come from real work" | 20261103020000 |
| R-M5-2 | S2 | Day-card finish: row vanished, wrong task on 2nd tap, no undo | E2E R-M5-2 | DayCard |
| R-M5-3 | S2 | Capture text lost offline | E2E R-M5-3 | BacklogList |
| R-M5-4 | S2 | No loading/error state ("Nothing here" forever) | E2E load errors | BacklogList |
| R-M5-5 | S2 | Same weekday went 7 days out (invisible) | unit capture | parse.ts |
| R-M5-7 | S3 | Day card not deadline-sorted | E2E R-M5-2 (order) | DayCard |

## Known issues (S3/S4 only)
| ID | Sev | Description | Plan |
|---|---|---|---|
| R-M5-6 | S3 | Capacity always includes Work even for a Focus-only task | fix with M10 capacity view |
| R-M5-8 | S3 | Long unbroken title pushes the sheet's Close off-screen | min-w-0 + overflow-wrap |
| R-M5-9 | S3 | Double-tap Done then lands on "Not done yet"; Remove has no undo | polish |
| R-M5-10 | S3 | Export misses coin_grants (= R-M1-1) | next small fix |
| R-M5-11 | S3 | No events for update/reopen | add events |
| — | S4 | Capped (150/day) completion says "coins only count once" | message per reason |
