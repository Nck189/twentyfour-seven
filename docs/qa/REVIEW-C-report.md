# QC report: review fix Phase C — the first minute

Plan: `docs/REVIEW_FIX_PLAN.md` Phase C (C1–C5). One migration: `20261120000000_first_capsule.sql`.

| Gate | Result | Evidence |
|---|---|---|
| G1 Static | ✅ | typecheck, lint, Prettier, i18n (1284 keys, EN = TH) |
| G2 Functional | ✅ Chrome locally / ⏳ WebKit in CI | Unit + integration 720 (new: first day, missed first wake, first three days; the setup reward now pays seeds + 1 ticket). E2E on Chrome: 152 passed, 2 skipped. New: the first-day screen and the everyday one, a real new account from setup to the first-day Today, in-place first step and checklist (rewards once), the in-place editors never offered when only today is empty (Focus and a built-in Work), the strip in day order with one farm read, no layout shift when it arrives, every plot inside it at 360 and 672 px, one farm re-read after a check-in, the first capsule after setup. |
| G3 Visual | ✅ looked at | Today at 390 px on day one and day two, the strip at 360 / 390 / 672 px. Mac baselines still need `npm run e2e:update` (new icon from Phase A). |
| G4 UX | ✅ | Day one keeps to one thing (current block); the rest, setup included, is one tap away. Nothing moves under a finger when the strip arrives. 44 px targets. The in-place editors say they apply to every day. |
| G5 Data & security | ✅ | The first ticket is paid by the server (`_setup_reward`, once per account through `unlock_grants`); accounts that already claimed sleep times get nothing more. `setBlockDefault` writes only the user's own `settings` row (RLS). No key in git. |
| G6 Production | ⏳ | Before merge: Minnie runs `npx supabase db push --remote` (the migration above). After merge: `npm run qc:prod`; make a new account on the phone and walk the first day. |
| G7 Independent review | ✅ PASS (round 3) | Round 1 `docs/qa/REVIEW-C-review.md`: FAIL (R-C-1, R-C-2, S2). Round 2 `docs/qa/REVIEW-C-rereview.md`: FAIL (N-1, S2: built-in first steps are `null` in settings, so "None" for today still offered the picker on Wake/Work). Round 3 (same file): PASS. Every S2 was fixed test-first (a failing E2E before the fix): R-C-1, R-C-2, N-1. Also fixed: R-C-3, R-C-4, R-C-5, R-C-7, R-C-8, R-C-9, R-C-10, R-C-11, R-C-12, R-C-13, N-2, N-3, N-4. |

Known issues (S3/S4, deferred; judgment calls in `docs/DECISIONS.md`, 2026-11-20):
- **R-C-6 (S3, kept):** someone who signs up before their wake time gets the folded screen only until that first "I'm up". Revisit with sign-up-by-hour data.
- **N-5 (S4):** two in-place edits inside one round trip can still race (read then write of `settings.blocks`).
- **N-6 (S4):** if the farm can't be read, the strip's space goes away and Today moves up once (error path only).
- **N-7 (S4):** the timeline sheet doesn't offer the in-place editors (the current-block and bed cards do).
- **N-8 (S4):** the R-C-2 test can pass trivially if the farm arrives before "I'm up" first renders; no E2E for the capsule waiting on Som's scene with the story on; the R-C-8 test has no midnight skip; the "every day" line isn't linked with `aria-describedby`.
- **Round 3 notes (S4):** a kind of day that sets Focus/Free to "no first step" while the default is empty still shows the picker (the save is safe, today's card stays empty).
- **R-C-14:** `history.replaceState` runs during render on the farm.
- **R-C-15:** "Everything else today" has no visible open/closed sign.
- **R-C-16:** the Down hint mentions the Night ritual even after it's done.
- **R-C-17:** the sleep-times reward now shows a ticket picture.
- **R-C-18:** the client uses the default 15-minute wake window, not the user's setting (it only matters on sign-up day).
- **R-C-19:** small wording and a11y points.
