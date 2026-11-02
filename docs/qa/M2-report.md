# QC Report — M2: Scheduling engine (pure logic)
Date: 2026-11-02 · Commit: 85a7665 (CI: QC runs #21/#22 green) · Prod URL: n/a (no UI in M2)

## Gate results
| Gate | Result | Evidence |
|---|---|---|
| G1 Static | ✅ | tsc 0 · eslint (max-warnings 0) 0 · prettier clean · i18n 0 missing keys · art lint 0 (`npm run qc:static`, CI) |
| G2 Functional | ✅ | `tests/unit/engine.test.ts` 39/39 (every SPEC §3 scenario + 8 fast-check invariants) · full regression green on CI (unit 85 · integration · e2e all projects) · coverage `lib/engine` stmts 98.9% · branches 99.0% · funcs 97.2% · lines 98.6% (gate ≥ 90%) |
| G3 Visual QC | n/a | M2 has no UI; the engine's output is rendered by Today (M3 report) |
| G4 UX QC | n/a | no UI |
| G5 Data & security | ✅ | pure functions, no I/O (architecture rule) · secrets check clean on CI |
| G6 Production smoke | n/a | nothing user-facing ships in M2; the engine reaches prod through Today, checked in M3's G6 |
| G7 Independent review | ✅ | combined M1–M3 review (fresh subagent, local session). M2 findings: F1 fixed; F2 S3, F4/F5 S4 logged below; F3 was a spec question, answered and implemented (below). No open S1/S2. |

## Rubric
n/a (no UI in M2).

## Issues found & fixed
| ID | Sev | Found by | Description | Regression test added | Fixed in |
|---|---|---|---|---|---|
| M2-F1 | (not recorded) | G7 review | Timeline gap when tomorrow is overridden / late night | `tests/unit/today.test.ts` | d3fbf97 |

## Known issues (S3/S4 only)
| ID | Sev | Description | Plan |
|---|---|---|---|
| M2-F2 | S3 | Several fixed events in different blocks on the same day aren't compressed together | revisit with M5 Backlog / M9 modes |
| M2-F4 | S4 | Review nit (details not recorded in the local session) | log only |
| M2-F5 | S4 | Review nit (details not recorded in the local session) | log only |

## Spec change after review
- **M2-F3 (answered by Minnie 2026-11-02):** an evening event that doesn't fit used to cut Sleep and move wake earlier while Work was never touched. Now Work gives way first (down to 50% of its length), then Down → Wake → Sleep; on a day with a class/appointment in Work, Work stays whole (old order). Test-first: 2 new failing scenarios → fix; the "+10h" scenario's expectations changed with the spec (sleep is now kept); the minimums case moved to "+14h". SPEC §3 + DECISIONS updated. Engine 39/39, coverage 98.9%.

## Independent review
Covered by the combined M1–M3 review run in the local session (its full text wasn't saved to the repo; findings are summarized in `docs/PROGRESS.md` and above).
