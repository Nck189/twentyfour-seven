# QC Report — M4: Night ritual + Plan screen
Date: 2026-11-03 · Branch: PR #5 · Prod URL: https://twentyfour-seven.vercel.app

## Gate results
| Gate | Result | Evidence |
|---|---|---|
| G1 Static | ✅ | tsc 0 · eslint (max-warnings 0) 0 · prettier clean · i18n 0 missing (389 keys) · art lint 0 · no emoji (unit guard) — CI QC #66/#67 |
| G2 Functional | ✅ | E2E CJ-07..10, Plan week view, ritual reason-for-all, R-M4-3 started block, R-M4-5 Goodnight unsaved, R-M4-6 wake-day tomorrow, appointments · integration night (ticket once, dates, before-bed window) · unit engine (incl. hostFor, drift), today |
| G3 Visual QC | ⏳ | Plan was redesigned (week strip + day card + month view); ritual uses icons — preview screenshots checked in the cloud (light/dark), but the Mac baselines + rubric pass are still to do |
| G4 UX QC | ✅ | ritual < 2 min (CJ-07), targets ≥ 44 px, axe 0, "Move to…" fallback for every drag, no emoji |
| G5 Data & security | ✅ | Night ticket server-side, once per night, only before bed; day overrides never touch templates; merge RPC checks template ownership |
| G6 Production smoke | ✅ (pre-fix) | prod 22/22 2026-11-03; re-run after PR #5 |
| G7 Independent review | ✅ | review 1 → fixes → re-review 1 FAIL → fixes → re-review 2 (no S1) → fixes → **re-review 3 PASS** (`G7-rereview-3-2026-11-03.md`, head a1f4f90): no open S1/S2; R4-1..3 S3 + S4s logged below |

## Issues found & fixed
| ID | Sev | Description | Regression test | Fixed in |
|---|---|---|---|---|
| R-M4-1 | S1 | Planned push not honored by the Sunrise window | integration wake-freeze | 20261103010000 |
| R-M4-2 | S1 | Sheet stole focus on every re-render (keyboard closed; likely CJ-07 flake) | unit sheet.test.tsx (jsdom) | BlockSheet |
| R-M4-3 | S2 | Close today: started blocks only got miss reasons | E2E R-M4-3 | NightRitual |
| R-M4-4 | S2 | Auto-opened ritual unmounted when Down ended | — (latched in render) | TodayScreen |
| R-M4-5 | S2 | Failed day-plan saves dropped; Goodnight granted anyway | E2E R-M4-5 | usePlan, NightRitual |
| R-M4-6 | S2 | Plan used the calendar date, the ritual the wake-day | E2E R-M4-6 | usePlan |
| R-M4-7 | S2 | Editor said "tonight" for every day; past night editable | — (labels) | DayEditor |
| R-M4-8 | S2 | Drift warning never fired | unit drift | lib/today/day |
| R-M4-9 | S2 | Only today..+6 plannable | appointments E2E (month view → any day) | MonthCalendar, PlanScreen |
| R-M4-10 | S2 | "Loading…" forever on load errors | E2E load errors | PlanScreen, NightRitual |
| R-M4-11 | S2 | Weekday without a template crashed Plan/Today/ritual | unit missing kind | templateFor |
| (M1/M3 reviewer) | S2 | Night ticket claimable next morning / at noon | integration night window | 20261103040000 |

## Known issues (S3/S4 only)
See `G7-M4-M5.md` R-M4-12+ (S3/S4) and `G7-rereview-3-2026-11-03.md`:
- ~~R4-2 (S3)~~ **fixed**: a Plan reload keeps days with an edit waiting, in flight or failed (`keepPending`, unit test).
- R4-3 (S3): no tests for R3-2 (live sync after an edit) / R4-2.
- S4: a failed background reload in Plan shows the error card (Today keeps its data); E2E no longer exercises the service worker (Minnie's iPhone check: a few cold starts).
 Seed planting deferred to M6 (needs the farm). Touch drag verified by hand on a real iPhone (E2E: mouse + "Move to…").
