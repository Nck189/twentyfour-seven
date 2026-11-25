# QC report: yard in two rows, Plan beside the farm, estimates Try again, test safety (2026-11-24)

| Gate | Result | Evidence |
|---|---|---|
| G1 Static | ✅ | `npm run qc:static`: typecheck, lint, Prettier, i18n (1333 keys EN/TH), art lint |
| G2 Functional | ✅ | Vitest 117 files / 769 tests (new: yard rows in reading order, visitors never on Som, preflight compare). Local E2E Chromium: 163 passed, 2 skipped, 1 failed once (CJ-SHARE-1, see below). New E2E: the side panel (dated task, task sheet, coins in the Shop) and estimates Try again |
| G3 Visual | ⏳ baselines | Yard and picker checked in the running app at 390 px. Mac/iPad baselines for the farm (side panel now Plan) and the yard need recording after merge |
| G4 UX | ✅ | Moving decor takes 2 taps; picker cells are ≥ 44 px (66 × 64 at 320 px); spot numbers are visible and match the labels; no layout shift |
| G5 Data & security | ✅ n/a | No server or migration changes; coins are still granted only by `complete_backlog_item` |
| G6 Production | ⏳ | After merge: `npm run qc:prod`, then the visual baselines |
| G7 Independent review | ✅ after fixes | `docs/qa/REVIEW-TS-review.md`: FAIL on 3 × S2, all in the first side-panel cut; fixed by using Plan there (below) |

## Review findings
- **S2-1, S2-2, S3-1, S3-2, fixed.** The backlog-only side panel lost dated tasks, couldn't open a task, and had a drag grip with nowhere to drop.
  - The panel is now the Plan screen, at h2 level.
  - Its day cards show dated tasks, its sheet opens a task, Move to… and drag work, and a load error offers Try again.
- **S2-3, fixed.** Finishing a task now sends the existing wallet-changed signal, so the Shop beside the farm reloads and the farm re-reads its coins (batched into one read). Covered by E2E.
- **S3-3, fixed test-first.** Butterflies hover over the item columns and birds walk the front row's gaps, never on Som. There are no visitors at night.
- **S3-4, fixed.** The visual error guard waits for the network to settle and now runs before every page screenshot (11 shots). Probed with no false positives on the login paste step, both Night ritual steps, plan-week and capsules, in EN and TH.
- **S3-5, S4-6, fixed.** The preflight can be skipped with `SKIP_DB_CHECK=1` (the message says so), runs only against a local Supabase URL, and warns instead of crashing outside the repo root.
- **S4-1, fixed.** The picker shows each cell's spot number, and the current cell is labelled "Spot n: here now".
- **S4-3, fixed.** Try again on the estimates card is disabled while it loads.
- **S4-4, fixed.** The side-panel test is in its own file, `tests/e2e/side-panel.spec.ts`.
- **S4-2, open.** A quick tap after a move, before the yard reloads, can open a stale sheet. The pattern predates this change.
- **S4-5, open for Minnie.** Visual baselines get recorded after merge.
- **S4-7, partly fixed.** There are no butterflies at night now. Thai plot labels truncated in the iPad-portrait farm column are a pre-existing issue, deferred.

## Seen once, not reproduced
- CJ-SHARE-1 failed once in the full local run: after "Stop sharing", the link was still shown. It then passed 3 out of 3 times on its own. No sharing code changed in this PR. Cause unknown; watch it in CI.

## Deferred
- S4-2 (a stale sheet after a quick tap).
- The iPad-portrait Thai plot labels.
