# G7 re-review 2: M10 (Stats + weekly review + first-time tips + streak milestones)

Branch `m10-local` @ `f42d443`. The fixes are in `d1f47b1`, compared against `bcae88f`; `f42d443` is docs only. The worktree `/home/user/m6-wt` was left untouched: `git status` is clean and HEAD is unchanged.

## Verdict: **PASS**

- No S1 or S2 is open.
- **R-M10-R1 (S2) is fixed.** I checked it with the real `<Tip>` component in headless Chromium with touch emulation:
  - a pan no longer closes a tip;
  - a tap still does;
  - a tip that appears when the Night ritual closes survives the tap that closed it.
- **R2–R7 are fixed**, and I verified each one (details below).
- **Three new S3s.** None of them blocks the milestone; they can be fixed now or logged as Known issues:
  - the fixes were not made test-first;
  - an outside tap can still close a tip that is off-screen;
  - the M10 report overstates who verified what.

| Severity | Open (new) | Open (carried) |
|---|---|---|
| S1 | 0 | 0 |
| S2 | 0 | 0 |
| S3 | 3 (R2-1, R2-2, R2-3) | 0 (R-M10-9 = R-M9-10, properly re-deferred to M14) |
| S4 | 4 (R2-4 … R2-7) | R-M10-14, R-M10-15 (both accepted); R-M10-16 and R-M10-17 partly fixed; R5 tick values |

## Status of earlier findings

| ID | Sev | Status | Evidence |
|---|---|---|---|
| R-M10-1 | S2 | ✅ Fixed (re-review 1) | Unchanged since then. |
| R-M10-2 … 8 | S3 | ✅ Fixed (re-review 1) | R-M10-3, 4 and 8 depended on R1, R2 and R5; all three are now fixed (see below). |
| R-M10-9 | S3 | ↪ Re-deferred to M14, bookkeeping done | It is listed in the M10 report Known issues, in BUILD_PLAN Status, and in the M14 "Carried over" lines with G3 and G4. Both conditions from re-review 1 are met. |
| R-M10-10 | S4 | ✅ Fixed | New constraint `profiles_tips_seen_known`. See R2-6 for its limits. |
| R-M10-11 | S4 | ✅ Fixed (see R6) | |
| R-M10-12 | S4 | ✅ Fixed (re-review 1) | |
| R-M10-13 | S4 | ✅ Fixed | `useTips.ts:81,86,91` logs `tip_dismissed`, `tips_skipped` and `tips_reset`. On the scratch DB, an authenticated user can insert all three (`INSERT 0 1`), and `weekly_review_done` and `night_ritual_completed` are still refused by RLS. |
| R-M10-14 | S4 | Accepted | |
| R-M10-15 | S4 | Accepted (in the report) | |
| R-M10-16 | S4 | ◐ Partly fixed | The slope now uses day offsets. Unit test `stats.test.ts:77` still passes (5.0). In my repro with days 2 and 3 missing, drift = 5, where the old index-based slope would give 8; one point gives `null`. The drift sparkline is still not built (polish). |
| R-M10-17 | S4 | ◐ Mostly fixed | The streak tip now sits under the header with the scarecrow art, and the heatmap headers are Mo…Su. The heatmap still has no colour legend. |
| **R-M10-R1** | **S2** | ✅ **Fixed** | Details below this table. |
| R-M10-R2 | S3 | ✅ Fixed | Details below this table. |
| R-M10-R3 | S3 | ✅ Fixed | Details below this table. |
| R-M10-R4 | S3 | ✅ Fixed | `StatsScreen.tsx:85-91` passes `usedBlocks(data.days)`, the whole window, into `weekSummary`. Same repro as before (Work skipped all week): the default gives `best=down/worst=free`; the window-wide block list gives **`worst=work`**, which matches the heatmap rows. There is no unit test for it (R2-1). |
| R-M10-R5 | S3 | ✅ Fixed | Measured with real tick positions on `/dev/stats` at 390 px, EN light and TH dark, with the TH font active:<br>• H:mm ticks start at x≈19 px inside the svg (`6:28`…`9:57`).<br>• I edited the scratch copy's fixture so weekend wakes fall around 10:50; 5-character ticks (`10:08`…`11:28`) start at x≈12.4 px in TH. Nothing is clipped (crops: `g7m10c/axis-*-th-*.png`).<br>• The ticks are still odd values (9:13, 9:57); that S4 polish is still open.<br>• The TH screenshots in the scratchpad (21:31) predate the fix (21:43). Re-shoot them before G3 (R2-3). |
| R-M10-R6 | S4 | ✅ Fixed as proposed | Tested on a **UTF8** DB with ctype C.UTF-8 (and also ctype C):<br>• **Refused:** ASCII blanks, NBSP, U+3000, ZWSP, BOM; in C.UTF-8 also U+2003, U+2009, U+2028 and U+1680.<br>• **Still accepted (server):** U+202F and U+2007 (glibc doesn't count them as space); ZWNJ, ZWJ, U+2060 and U+3164 pass both server and client.<br>• Under ctype C, `\s` is ASCII-only, so em and thin spaces pass too. Production ctype decides which case applies.<br>• The client regex (`\s` in JS covers every Zs character) refuses U+202F and U+2007, so only direct RPC callers get through. It's an honor system, so this residue is acceptable. |
| R-M10-R7 | S4 | ✅ Fixed | (a) `.order("at")` on the rituals query.<br>(b) `profile.error` now joins the error chain, so a failed read shows the error state instead of 28 days.<br>(c) The help text says "Bedtime is when you did the Night ritual" in EN and TH. |

**R-M10-R1 (S2): evidence for the fix.**
- `Tip.tsx:39-45` listens for capture `click`. `TodayScreen.tsx:133-134` defines `tipsQuiet = onboarding.ready && !onboarding.show && !ritualOpen && !autoOffer && !openKey && !menuOpen`; it is defined before use and after every input it reads. All 5 Today tips use it.
- The harness (`g7m10c/app/app/dev/tipqa`, scratch copy only) mounts the **real** `<Tip>`, gated `when={!ritualOpen}` behind an auto-open `aria-modal` dialog. Context: 390×664, `hasTouch` + `isMobile`, touches sent via CDP.
- Results:
  1. While the ritual is open, 0 tips show.
  2. Tapping the ritual's Close shows 1 tip and **does not dismiss it**. The same click can't reach the new listener: document capture has already passed when React commits.
  3. A pan starting on a paragraph keeps the tip (scrollY 252, no dismiss).
  4. A pan starting on a button keeps the tip (scrollY 433).
  5. A pan starting on the tip keeps it.
  6. A tap on a plain paragraph dismisses the tip.
  7. A tap on a header control dismisses the tip, and the control's own `onClick` still runs (capture dismiss happens first).
  8. "Got it" dismisses the tip.
- The double `dismiss:` lines in the log come from my harness wrapping the store twice under StrictMode, not from the app.
- **Is closing a tip on a tap of a Today control acceptable?** Yes. BUILD_PLAN says "a tap outside closes it"; the user saw the bubble and acted elsewhere, and the control still works. See R2-2 for the one case where they didn't see it.

**R-M10-R2 (S3): evidence for the fix.**
- At Down Time, `autoOffer` and then `ritualOpen` keep `tipsQuiet` false, so no tip is mounted under the ritual.
- `dismissNightOffer` clicks Close, which sets `ritualDismissed`. The `night` tip then mounts after the click, so `expect(tip).toHaveCount(1)` holds. Harness step 2 shows the same mechanism with real React 19.
- The spec still doesn't assert *which* tip shows (suggested in re-review 1, optional).
- One residual risk is not new: if the ritual appears more than 2 s after `goto`, `dismissNightOffer` misses it. This is shared by every spec that uses `gotoToday`.
- E2E was not run (no Supabase stack).

**R-M10-R3 (S3): evidence for the fix.**
- **Grants.** On the scratch PG16, `authenticated` holds UPDATE only on `display_name, locale, onboarding, sound_on, timezone, tips_off, tips_seen`. There is no table-level UPDATE; `service_role` keeps it.
- **Blocked writes:** `created_at`, `updated_at` and `user_id` updates all fail with `permission denied`.
- **Every app write path still works** (`UPDATE 1`). I grepped every `.from("profiles").update/upsert` in app code and tests:
  - `MoreScreen` locale + onboarding;
  - the `ProfileSync` conditional update (`onboarding->locale_set is null`) and the plain locale update;
  - `useOnboardingState` and `useSetup` onboarding updates;
  - `useTips` tips_seen and tips_off;
  - timezone changes, which still pass the M8/M9 triggers;
  - `RETURNING`, which is what `return=representation` does;
  - `SELECT … FOR UPDATE`.
- **No upserts on profiles exist.** Tests that write `created_at` use `admin()` (`weekly-review.test.ts:11`, `streak.test.ts:21,177`) or the service-role `rest()` (`streak.spec.ts:34`, `stats.spec.ts:27`), so none of them break. User-client tests only update `timezone` (backlog, animals, streak) or `onboarding` (setup-rewards).
- **No trigger or security-invoker function updates `profiles`.** The `set_updated_at` BEFORE trigger only edits NEW.
- **Timezone trick, retried** on a mocked clock:
  - B signs up Fri 18:59 BKK. On Sunday 20:00 BKK, switching to `Etc/GMT+12` succeeds (`UPDATE 1`), but status stays `week_start:null` and submit is refused. The same happens with `Pacific/Kiritimati`.
  - The `created_at` write is denied.
  - An old account still opens 11-09.
- **Side effect:** the UTC date shifts the "from Thursday" rule by the user's offset (R2-5).

## New findings

| ID | Sev | Where | Repro / evidence | Fix |
|---|---|---|---|---|
| **R-M10-R2-1** | S3 | `d1f47b1` (no files under `tests/`); QA_QC.md:6 | The R-series fixes landed with **no new or changed tests**: unit tests are still 268/268 in 41 files, the same as at `bcae88f`, and `git diff bcae88f d1f47b1 -- tests` is empty. QA_QC: "A bug fix starts with a failing test." Re-review 1 asked for these tests specifically:<br>• a touch-pan test for tips (R1);<br>• an integration test that a `created_at` update is refused and a Sunday tz switch keeps `week_start` null (R3);<br>• a unit test for the week-vs-window worst block (R4).<br>None exists. I verified the behaviour by hand, but nothing stops it from regressing. | Add:<br>• `stats.test.ts`: a block used earlier in the window and skipped all week → `worstBlock`. Also a drift-with-gaps case (days 2 and 3 missing → 5, not 8).<br>• `weekly-review.test.ts`: `u.client…update({created_at})` returns an error; `update({timezone:'Etc/GMT+12'})` on a too-new account keeps `week_start` null; a Unicode-blank answer is refused.<br>• `tips.spec.ts`: a touch scroll on Today keeps the tip and `tips_seen` stays empty (Playwright `hasTouch` + `page.mouse.wheel` or a CDP touch). |
| **R-M10-R2-2** | S3 | `components/tips/Tip.tsx:39-45`; `TodayScreen.tsx:273` | A tap anywhere outside the bubble marks it seen, **even when the bubble is off-screen**. Most likely case: the `exercise` tip sits under the Exercise card, below the current-block card and its checklist. On a visit where it is the active tip (after first10 was seen), the user's first tap on Start or a checklist item above the fold marks `exercise` seen, though it was never on screen. That is the "shown zero times" outcome R1 described, now through taps instead of scrolls. The streak tip no longer has this problem (it is now under the header). Static analysis plus the harness behaviour (case 6/7: any outside tap dismisses). | Count an outside tap as "seen" only if the bubble has been at least half visible: an IntersectionObserver on `box` sets a `wasVisible` ref, and `onDown` dismisses only if `wasVisible`. Optionally, if it was never visible, just set `dismissedThisVisit` and leave it unseen. Write the test first: a tip under the fold plus a tap above the fold leaves `tips_seen` empty. |
| **R-M10-R2-3** | S3 | `docs/qa/M10-report.md` (G2 row, G3 row) | (a) G2 says "Scratch Postgres 16 (UTF8) … Verified: review window and payout, column grants, the tips constraint, Unicode blanks, and milestone parity (by the reviewer)." No reviewer had seen the column grants or the constraint before this review; they first appear in `d1f47b1`. This review now verifies them, but the attribution was ahead of the facts.<br>(b) G3 says the `/dev/stats` screenshots were "sent to Minnie". The files in the scratchpad (21:31) predate the H:mm axis fix (`d1f47b1`, 21:43), so Minnie has the old clipped TH axis.<br>(c) The report says nothing about the R-series fixes having no tests (R2-1).<br>Otherwise the report is honest: CI blocked (Actions minutes), G3/G6 pending, M14 deferrals, and the Sleep/Perfect-day open question all appear in the report, in PROGRESS "Now" and in BUILD_PLAN Status. | Re-word G2: "column grants, tips constraint and Unicode blanks verified by G7 re-review 2". Re-shoot TH dark and EN light, and send the new shot. Add a line on the missing tests (or add the tests). Fill in the G7 row with this re-review. |
| R-M10-R2-4 | S4 | `docs/DECISIONS.md` (tail) | There is no entry for the re-review-1 judgement calls:<br>• the review week is judged by the **UTC** sign-up date, not local;<br>• the client may only update a whitelist of profile columns (future profile columns need a grant);<br>• Today hides tips while any sheet, the menu or the ritual is open.<br>CLAUDE.md: "Log any judgment call in docs/DECISIONS.md." | Add a "2026-11-10 · G7 M10 re-review 1 fixes" entry. |
| R-M10-R2-5 | S4 | migration `_review_week` (L35-41) | UTC shifts the rule "around from Thursday" by the user's offset. Mocked clock:<br>• A BKK sign-up on **Fri 00:30** (Thu 17:30 UTC) now gets that week's review (`week_start 2026-11-09`); before, it was refused.<br>• An LA user who signed up **Thu 18:00 PST** (Fri 02:00 UTC) is refused.<br>The window is 7 h each way; an account gains at most +3 tickets, once. | Accept and log it (R2-4). A tz-proof alternative is an existing `wake_events` row in `wk..wk+3`. |
| R-M10-R2-6 | S4 | migration L139-142; `lib/tips/useTips.ts:28-33` | (a) The comment says "at most once each", but the check is only `cardinality ≤ 8`, so `['wake','wake']` is accepted.<br>(b) `save()` ignores the update error. The current client can't violate the constraint (TIP_IDS equals the constraint list, and `seen` is a Set). But if a 9th tip is added to `content/tips.ts` without a migration, every dismiss fails **silently** and tips come back on each visit.<br>(c) `tips-sql.test.ts` mirrors the grandfather array but not the constraint array. | Fix the comment, or check distinctness (e.g. `cardinality(tips_seen) = (select count(distinct x) from unnest(tips_seen) x)` via an immutable helper). Make `save` surface or log the error. Extend the mirror test to the constraint's array. |
| R-M10-R2-7 | S4 | `TodayScreen.tsx:176`; `Tip.tsx:62-65` | The streak tip's arrow is fixed at `left-8`, so under the header it points at the title. The streak chip is at the top right. | Give `Tip` an arrow-position prop (e.g. `arrow="right"`). |

**Unverified note.** In Next.js App Router, React's root container is `document`. iOS Safari is known not to dispatch `click` for taps on non-interactive elements unless the element or an ancestor below `body` is "clickable". If that applies here, then on an iPhone a tap on plain text outside the bubble would not close it; buttons and links would. That errs toward keeping the tip, so it is harmless, but "a tap outside closes it" may be partial on iOS. Check it on a real device in the playtest.

## What I verified and how

- **G1 static** (in `/home/user/m6-wt`, read-only):
  - `npx vitest run tests/unit`: **41 files, 268/268 pass**.
  - `npm run -s lint`: exit 0.
  - `npx tsc --noEmit -p .`: exit 0, with no LayoutProps noise this time.
  - `npm run -s i18n:check`: "746 keys in en/th".
  - `npx prettier --check .`: clean.
  - HEAD `f42d443`, clean worktree, branch also on `origin/claude/practical-cannon-a70ubq`.
- **Diff review:** every hunk of `bcae88f..d1f47b1` (components, lib, messages, migration) plus the `d1f47b1..f42d443` docs (M10 report, PROGRESS "Now", BUILD_PLAN Status and M14 carry-overs, DECISIONS tail).
- **Tips (real component):**
  - I unpacked the code with `git archive f42d443` into `scratchpad/g7m10c/app` (hardlinked node_modules) and added a scratch-only `/dev/tipqa` page.
  - Ran `next dev` on :3997 with dummy Supabase env.
  - Drove it with Playwright Chromium (`/opt/pw-browsers/chromium`): 390 px wide, touch and mobile, with CDP touch pans and touchscreen taps (`g7m10c/tipqa.mjs`). Results are in the status table above.
- **Stats** (real modules via tsx, `g7m10c/ts/repro.ts`):
  - R4 window-vs-week worst block;
  - drift with gaps;
  - drift with a single point.
- **Wake axis:** `/dev/stats` in EN light and TH dark, weekday and weekend. I measured tick-label x positions (`g7m10c/axis.mjs`) with the default fixture, then with a late-wake fixture (edited in the scratch copy only); crops are `g7m10c/axis-*.png`.
- **Scratch Postgres 16:**
  - Fresh cluster on 127.0.0.1:55455, `-k ''`, data in `g7m10c/pg`. Port 55445 was not touched.
  - Roles were created, then `pg9/stub.sql` without its role lines.
  - All **20 migrations applied cleanly** to:
    - `t`: UTF8, C.UTF-8, real clock;
    - `tc`: UTF8, ctype C;
    - `tt`: UTF8, `now()` → `test.now`-driven `_tnow()`;
    - `tg`: migrations 1–19, then 3 profiles, then M10.
  - **Grandfather update:** all 3 rows got exactly the 8 ids, and `profiles_tips_seen_known` is `convalidated`.
  - **Constraint:** unknown id, 9 entries, `array[null]` and NULL are refused; `['wake','wake']` is accepted (R2-6).
  - **Grants and write paths:** R3 above (`g7m10c/t1.sql`).
  - **Events policy:** the 3 tip events are allowed; the server-only types are refused.
  - **anon:** profile update and `weekly_review_status` are denied.
  - **Review window** (`g7m10c/t2.sql`): BKK Thu/Fri sign-ups, an LA sign-up, an old account, the `Etc/GMT+12` and `Kiritimati` switches, the `created_at` write, Unicode blanks (stored values are trimmed to `k`/`p`/`t`), and one `weekly_review_done` event plus one `ticket_granted`.
  - Acted as users with `set role authenticated; set request.jwt.claim.sub = …`.
- **Not run:** E2E and integration (no Supabase/Docker stack in this container); CI is blocked by Actions minutes.
- **Cleanup:** the dev server is stopped, the scratch cluster is stopped and deleted, the `g7m10c/app` copy is removed, and `/tmp/claude-0` is restored to 700.
