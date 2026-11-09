# G7 re-review — M10 (Stats + weekly review + first-time tips + streak milestones)

Branch `m10-local` @ `bcae88f` (fixes 88c8abd, 2d3d479, bcae88f vs 3d2a7a9). Worktree `/home/user/m6-wt` left untouched (clean, HEAD unchanged).

## Verdict: **FAIL**

There is 1 open S2, **R-M10-R1**, and the fix for R-M10-4 introduced it. Tips now close on `pointerdown` anywhere outside the bubble. On a phone, the first scroll gesture (or any tap inside a modal on top of the bubble, such as the auto-opened Night ritual) closes the tip and **permanently marks it seen**, even if the user never saw it. The fix is one line.

The original S2 (R-M10-1) is fixed and verified with the real modules. The other S3s are fixed or properly re-deferred, with the exceptions below.

| Severity | Open (new) | Open (carried) |
|---|---|---|
| S1 | 0 | 0 |
| S2 | 1 (R1) | 0 |
| S3 | 4 (R2–R5) | 0 (R-M10-9 re-deferred, see below) |
| S4 | 2 (R6, R7) | R-M10-10, 13, 14, 15, 16, 17 |

## Status of earlier findings

| ID | Sev | Status | Evidence |
|---|---|---|---|
| R-M10-1 | S2 | ✅ **Fixed** | Real `buildDayFacts` → `statsFrom` → `weekSummary`/`heatmap`/`dayOee` via tsx (`g7m10b/repro.ts`). A 5-day-old perfect account (created 11-04 08:00 BKK, today 11-09): 5 days shown, first = 11-04, OEE bars `100,100,100,100,100`, week avg 100 %, 5 perfect days, and the heatmap shows no days before sign-up (Mon/Tue judged 0). A sign-up at 06:30 BKK without a wake starts the next day, which matches `settle_days` (m9_streak.sql:459-465): same calendar-date-in-profile-tz rule plus the wake check. The wake chart is filtered by `start` too. Day OEE still counts Sleep (SPEC). The same account without a Sleep check-in gives **73 %/day and 0 perfect days**; see the deferral notes. |
| R-M10-2 | S3 | ✅ Fixed | `worstBlock` is set only when `worst.rate < best.rate` (stats.ts:229). The unit test covers it, and the repro gives `worst=null` when everything ties. |
| R-M10-3 | S3 | ⚠️ Fixed in code, re-broken by the R-M10-4 fix | `gotoToday` is used (tips.spec.ts:40). But at Down Time the `Close` click on the ritual now closes the night tip → **R-M10-R2**. |
| R-M10-4 | S3 | ⚠️ Fixed, but too broad | It uses `pointerdown` → **R-M10-R1 (S2)**. |
| R-M10-5 | S3 | ✅ Fixed | All 5 Today tips gate on `onboarding.ready && !onboarding.show` (TodayScreen.tsx:225-268). `ready` = state loaded (useOnboardingState.ts:42). |
| R-M10-6 | S3 | ✅ Fixed for honest users, ⚠️ bypassable | Scratch PG16 with mocked clock: Sun 14:00 sign-up → closed, submit refused; Fri 00:30 → closed; Thu 09:00 → open week 11-09; Mon 08:00 (before wake) → open for its own week, not the week before. An old account's window is unchanged (open Sun 10:00 → Tue 10:00 BKK). The rule can be beaten from the client → **R-M10-R3**. |
| R-M10-7 | S3 | ✅ Fixed as decided (DECISIONS 2026-11-10) | Bedtime = the first in-time `night_ritual_completed` event, which is server-only (events policy) and carries `in_time` since 20261103050000. `usedBlocks` drops blocks that were never checked in. Side effects: **R-M10-R4**, R7. |
| R-M10-8 | S3 | ◐ Partly | TH shots were re-taken (21:31) and are really Thai now (`heat.day` จ/อ/พ/พฤ…, KPT labels stay English as decided). The TH wake-axis still clips the leading digit → **R-M10-R5**. R5 rubric score for TH: not written yet (no M10 report). |
| R-M10-9 | S3 | ↪ Re-deferred to M14 | See the deferral notes. Acceptable with conditions. |
| R-M10-10 | S4 | Open | `tips_seen` is still unconstrained. Not addressed. |
| R-M10-11 | S4 | ✅ Fixed for ASCII whitespace | `E'\n\t \r'` is refused. Unicode blanks still pay → **R-M10-R6**. |
| R-M10-12 | S4 | ✅ Fixed | Submit + 2 edits → 1 `weekly_review_done` event (`tickets:3`). 6 parallel submits → tickets 3, 1 grant, 1 event. |
| R-M10-13 | S4 | Open | No tip events. |
| R-M10-14 | S4 | Open (harmless) | |
| R-M10-15 | S4 | Open | |
| R-M10-16 | S4 | Open | |
| R-M10-17 | S4 | Open | |

## New findings

| ID | Sev | Where | Repro / evidence | Fix |
|---|---|---|---|---|
| **R-M10-R1** | **S2** | `components/tips/Tip.tsx:36-44` | The outside-tap listener uses `document.addEventListener("pointerdown", …, true)`. On touch screens `pointerdown` fires at the **start of a scroll pan**, before `pointercancel`. Repro (`g7m10b/pan.mjs`): headless Chromium, 390×844, `hasTouch`/`isMobile`, same listener logic, vertical pan via CDP `Input.dispatchTouchEvent`. Result: `pan: ["pointerdown→dismiss","pointercancel"]` with scrollY 205 and **no `click`**. A real tap gives `pointerdown` + `click`. Consequences on iPhone:<br>(a) Scrolling Today closes the visible tip and marks it seen. The bubble is in the page flow, so the content jumps under the finger.<br>(b) A tip below the fold (exercise/streak sit under the Exercise card) is marked seen by the very scroll the user makes to reach it, so it is never seen.<br>(c) At Down Time the Night ritual auto-opens (TodayScreen.tsx:124-132) over the `night` tip (line 225). The first tap inside the ritual closes the night tip unseen. The same happens with any `aria-modal` sheet (BlockSheet, HatchReveal) over a mounted tip.<br>This breaks BUILD_PLAN M10 "each shown once" (here: shown zero times) and "a **tap** outside closes it". It is touch-only, which is the primary platform → S2. | Listen for `click` (capture) instead of `pointerdown`: no click fires after a pan. Ignore events whose target is inside `[aria-modal="true"]`, or better, don't mount tips while an overlay is open: on Today, add `&& !ritualOpen && !openKey` to the `when`s. Add a test first: a Playwright touch-scroll on Today keeps the tip and `tips_seen` stays empty. Optionally dismiss only if the bubble was in view (IntersectionObserver). |
| R-M10-R2 | S3 | `tests/e2e/tips.spec.ts:40-41` + R1 | During the user's Down block (90 min/day), `gotoToday` → `dismissNightOffer` clicks the ritual's **Close**. That `pointerdown` closes the mounted `night` tip (`dismiss` → `dismissedThisVisit=true`), so `expect(tip).toHaveCount(1)` fails, unless the tips store happens to load after the click (a race). This is the same class of failure R-M10-3 fixed. Static analysis only: no Supabase stack here to run E2E. | It falls out of the R1 fix (gate tips on `!ritualOpen`). Also assert which tip shows (`toContainText`) so a missing tip is visible in the failure. |
| R-M10-R3 | S3 | `supabase/migrations/20261110000000_m10_weekly_review.sql:35-41`; `profiles` grants (v1 schema) | Two ways a client can open the review for a week it wasn't around for (+3 tickets once per account):<br>(1) **`profiles.created_at` is client-writable**: `authenticated` has UPDATE on every profile column. Verified: `update profiles set created_at='2020-01-01'` → `UPDATE 1`, status opens `2026-11-09`, submit `granted:true`.<br>(2) **The timezone trick**: `created_on` uses the *current* `p.timezone`, while the wake-day is frozen by `wake_snapshots`, so the M9 "wake-day can't move back" guard lets the switch through. Verified: sign-up Fri 13 Nov 18:59 BKK; on Sun 20:00 BKK set `Etc/GMT+12` → `UPDATE 1` (wake-day stays Sun 11-15), status opens 11-09, `granted:true`; switch back to Bangkok → still 3 tickets. Same with `Pacific/Honolulu` for a Fri 00:30 BKK sign-up. Any sign-up up to Fri ~19:00 BKK qualifies this way. | Revoke the table UPDATE on `profiles` from `authenticated` and grant UPDATE only on `(display_name, locale, onboarding, sound_on, timezone, tips_off, tips_seen)` (check `updated_at` too). That also protects `settle_days`'s first-day rule, which reads the same column. Make the rule timezone-proof, e.g. require a server-written wake in the first half of the week (`exists wake_events where date between wk and wk+3`). wake_events.date is frozen, which also matches "the account was around". Or compare instants with a fixed zone. Add an integration test first: a `created_at` update is refused, and a tz switch on Sunday keeps `week_start` null. |
| R-M10-R4 | S3 | `lib/stats/stats.ts:208` (`weekSummary` → `usedBlocks(days)` over the **week** only); `StatsScreen.tsx:80` | A block the user ignored all week (no check-in at all, the most common way to skip) drops out of the week's best/worst, so **"Needs love" never points at the block that most needs it**. Repro (repro.ts §2): Work done for 3 weeks, then never opened in the review week. Heat rows include `work` (Mon 3/4), the week rows don't, and the result is `best=down worst=free`. The 28-day heatmap and the week summary disagree about which blocks are judged. | Compute the judged set once over the whole Stats window (`usedBlocks(data.days)`) and pass it into `weekSummary` (and `heatmap`) as a parameter. Add a unit test: a block used earlier in the window and skipped all week is the worst. |
| R-M10-R5 | S3 | `components/stats/StatsScreen.tsx:200-209` (YAxis `width={50}`, margin left 0) | 2d3d479 fixed EN, but `scratchpad/m10-stats-dark-th.png` still cuts the leading "0" of every wake tick (`09:57`, `08:18`, `07:23`, `06:28` show as `)9:57`…; crop in `g7m10b/crop-th.png`; EN crop is fine). IBM Plex Sans Thai Looped digits are wider. Ticks are also odd values (09:57/09:13), which is S4 polish. | Use `width={58}` or a locale-aware width, or format ticks as `H:mm`. Use round tick values (`ticks` at 30-min steps). Re-shoot TH. |
| R-M10-R6 | S4 | migration L56-58 | `btrim(..., E' \t\r\n')` misses Unicode blanks: `submit_weekly_review(E' ', E'　', E'​')` → `granted:true`. ZWSP also gets past the client `.trim()`. Honor system. | Use `regexp_replace(x, '[\s 　​﻿]', '', 'g') = ''` as the emptiness check. |
| R-M10-R7 | S4 | `lib/stats/useStats.ts:60-67,85,97-101`; `messages/*` `stats.sleep.bed/help` | (a) The rituals query has no `.order("at")`, so "the first in-time ritual" depends on row order. Redoing the ritual in time writes another `in_time` event. (b) `profile.error` is ignored: on failure Stats silently fall back to 28 days, which is the R-M10-1 view again. (c) "Bedtime spread" now measures Night-ritual time, which can be ~3–14 h before the next wake, but the label/help still says bedtime. | `.order("at")`; treat `profile.error` like the other errors; help text "Bedtime = when you did the Night ritual". |

## Deferrals and flags (judgement)

- **R-M9-10 → M14 (unlock reward animation, streak-egg hatch reveal): acceptable.**
  - It is an S3, and QA_QC §fix-loop lets S3s be logged as Known issues.
  - Conditions: it is the **second** deferral (M9→M10→M14), so it must appear in the M10 report's Known issues and in BUILD_PLAN Status.
  - It must also be added to the **M14 prompt or Growth line**, which currently lists only onboarding/perf/a11y… and G1/G8/G15; otherwise it gets lost.
- **G3 retention dashboard / G4 weekly share card → M14: acceptable.**
  - Neither is in the M10 prompt or "Done when"; they came in as growth notes (M8 → M10 by DECISIONS).
  - Same bookkeeping needed: add G3/G4 to BUILD_PLAN M14's Growth line, and to Status "deferred".
  - Worth one line to Minnie: G3 is the tool for reading the playtest pilot that runs right after M10. She may want it before the pilot rather than after M14.
- **Sleep / Perfect-day: flagging instead of fixing is the right call for M10, but it needs to be raised properly.**
  - It is pre-existing: `TodayScreen.tsx:137` hides the Sleep card (blame 2026-11-02, M3), the Night ritual skips Sleep, and Day OEE / `_day_oee` count all 7 blocks (SPEC §7, M9 server).
  - Fixing it changes a SPEC-defined, reward-bearing formula in TS **and** SQL, and CLAUDE.md says to "stop and explain the trade-off before deviating".
  - It is real: a user who does everything Today offers gets **73 % Day OEE and 0 Perfect days** (repro), so the Perfect-day ticket and Rainbow mutation are effectively out of reach. That is S2-class, pre-existing and not M10's regression, so I don't count it against this verdict.
  - Right now it lives only in DECISIONS, which is a log of decisions, not a question queue. Put it in PROGRESS.md as an open question for Minnie, with the two options and a recommendation, and in the M10 report Known issues.

## What I verified and how

- **G1 static** (in `/home/user/m6-wt`, read-only):
  - `npx vitest run tests/unit`: **41 files, 268/268 pass**.
  - `npm run -s lint`: exit 0.
  - `npx tsc --noEmit -p .`: 0 errors (no LayoutProps noise).
  - `npm run -s i18n:check`: "746 keys in en/th".
  - `npx prettier --check .`: clean.
  - `git status`: clean, HEAD `bcae88f`.
- **Diff review:** every hunk of 3d2a7a9..bcae88f in lib/, components/, supabase/, tests/ and DECISIONS.
- **Stats (real modules via tsx, `g7m10b/repro.ts`):**
  - the 5-day-old perfect account, with and without Sleep;
  - the sign-up-time edge (06:30 BKK without a wake → next day);
  - the week-vs-window `usedBlocks` case (R4).
  - Checked that `statsFrom` uses the same rule as `settle_days` (calendar date of `created_at` in profile tz, plus wake on that day), and that `ctx.timezone` is the profile tz.
- **Tips:**
  - Code read: Tip.tsx, useTips.ts, TodayScreen gating, onboarding `ready`.
  - Re-subscribe: `dismiss` is stable (zustand action + `useCallback`). The effect deps are `[show, dismiss]`, so there is no loop. The bubble's own buttons are inside `box`, so they are not caught by the outside listener.
  - Touch-pan behaviour confirmed in headless Chromium with touch emulation (`g7m10b/pan.mjs`).
- **E2E/integration soundness:**
  - `stats.spec.ts`: `created_at` = today−12 at 06:00 → `statsFrom` = today−11. That covers all 10 seeded days, and the review rule holds (≤ wk+3).
  - `weekly-review.test.ts`: −10 days satisfies ≤ wk+3 on both Sunday and Monday wake-days.
  - The "brand-new account → null" test is always true by construction. That's sound, but it can't catch R3.
  - `tips.spec.ts` is not sound at Down Time (R2).
  - E2E was not run: no Supabase/Docker stack in this container.
- **Scratch Postgres 16:**
  - 127.0.0.1:55453, `-k ''`, data under `scratchpad/g7m10b/data`.
  - Stub plus all 20 migrations applied cleanly into DB `t` (real clock) and `tt` (identical, with `now()` rewritten to a `test.now`-driven `_tnow()`; the rewrite was checked to be byte-identical to the previous review's for the 19 unchanged files).
  - Checks:
    - anon can't call status/submit or read `weekly_reviews`;
    - authenticated is refused on `_review_week`, direct insert into `weekly_reviews`, `weekly_review_done` events and `weekly_review` grants;
    - R-M10-6 matrix (4 sign-up times);
    - old-account window sweep (30-min steps, Sat→Wed);
    - whitespace rules (ASCII refused, Unicode passes);
    - one event per week;
    - 6 parallel submits;
    - `created_at` write bypass;
    - `Etc/GMT+12` and `Pacific/Honolulu` tz bypass (allowed by the M9 guard because the snapshot freezes the wake-day);
    - column privileges on `profiles`.
  - The cluster was stopped and deleted at the end, and `/tmp/claude-0` was restored to 700.
- **Visual:** looked at the re-shot `m10-stats-dark-th.png` / `m10-stats-light-en.png` and cropped the wake chart (R5).

Scratch artifacts: `scratchpad/g7m10b/` (t1–t5.sql, repro.ts, pan.mjs, crops).
