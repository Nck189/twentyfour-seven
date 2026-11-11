# QC report — Playtest R1 fixes (PR #14)

**Scope:** P1–P9, plus rule changes R1, R2, R3, R5 and R7 from `docs/playtest/R1/REPORT.md` (Minnie OK 2026-11-11).

## Gates
| Gate | Status |
|---|---|
| G1 Static | ✅ typecheck, eslint (0 warnings), prettier, i18n (789 keys EN/TH), art lint |
| G2 Unit + integration | ✅ 63 files, 447 tests (local Supabase). New tests: early-wake, credits (+ set-aside, + first-10), away-days (+ tamper), welcome-back (+ weekend), close-late. |
| G2/G4 E2E | ✅ locally on Chromium: 99 passed. CI runs the WebKit matrix. Today's extra load was lightened after CI showed ~2.5× main's WebKit "internal error" rate. |
| G3 Visual | ⚠️ The Thai baselines (Mac) need re-recording once: the Thai wording changed (P9). |
| G5 Secrets | ✅ CI |
| G6 Prod | After merge: Minnie runs `db push` (6 migrations), then `npm run qc:prod`. |
| G7 Independent review | FAIL, then fixed (see below). Re-review pending. |

## G7 findings and fixes (`docs/qa/R1-fixes-review.md`)
| ID | Sev | Finding | Fix |
|---|---|---|---|
| F1 | S1 | "Today went as usual" marked live, on-time blocks as backfilled, so their growth and Day score were lost | Client and server: a late close keeps a live start live (migration `20261111040000`) |
| F2 | S2 | R1's "first-10 within the block counts as a start" was never built | `startCounts` / `_start_counts` (migration `20261111060000`); the check-in now says "Started with the first 10" |
| F3 | S2 | An early "I'm up" left Today blank | The wake card stays, and "Next" shows the first block still ahead |
| F4 | S2 | The ritual listed a credited Wake as not done, and "same reason" gave it a miss | The ritual skips credited blocks |
| F5 | S2 | Deleting your own block logs faked away days (welcome-back ticket, erased misses) | Clients can no longer delete block logs (migration `20261111050000`) |

S3s fixed:
- The welcome copy no longer says "nothing was lost", and the goal reads "in the next 5 days".
- A welcome now needs 3+ away days, so a skipped weekend no longer pays every week.
- The ritual sheet no longer shrinks under a finger, so a double-tap can't close it.

## Known issues (S3/S4, deferred)
- P5: a double-tap on "Add a kind of day" adds two kinds, and opening setup from Today starts at step 1.
- P7: a few labels for credited blocks still differ between the timeline and the card.
- P1's set-aside writes a log on load, so a user whose day has a 0-min block is never "away" on days they open the app.
- Tapping the welcome-back button while offline gives no message.
- On iPhone, the "one more miss" line sits below the first screen.
- The gifts are one line of text, with no reward moment (R8 delight 3/5). Story events (orange cat) are planned after the economy PR.
