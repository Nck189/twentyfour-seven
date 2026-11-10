# G7 re-review 3: M10 (Stats redesign, Goodnight starts Sleep, check-in day window)

Branch `m10-local` @ `d95d29b`, reviewed against `847a8e0` (3 commits: `3ce88ba` Stats redesign, `b554c44` Goodnight starts Sleep, `d95d29b` guard window + E2E seed fix). The worktree `/home/user/m6-wt` was left untouched apart from this report: `git status` was clean and HEAD is unchanged.

## Verdict: **PASS**

- No S1 or S2 is open.
- **The math is unchanged.** `lib/stats` only gains `periodCompare` and `steadiness`. `dayOee`, `imrChart`, `sleepRegularity`, `heatmap`, `pareto`, `homeVsOut` and `weekSummary` are untouched, and the screen still feeds them the same window. No user-visible "OEE" remains: none in `messages/*.json`, and the E2E asserts `main` has no "OEE".
- **Goodnight → Sleep follows its stated rules.**
  - It never overwrites an existing start, first-10 or miss reason.
  - It starts Sleep only when Sleep's first-10 is off.
  - On-time stays ±10 min on both sides (`startedOnTime`, `_day_oee`, `_block_result` are unchanged).
  - It goes through the normal queued `upsertLog` path, so the server stamps and guards it like any check-in.
- **The guard window adds no new exploit** (see "Security" below).
- **Seven new S3s:**
  - two side effects of Goodnight now starting Sleep at ritual time (R3-1, R3-2);
  - three about Stats wording and visuals (R3-3, R3-4, R3-5);
  - one edge case with Sleep checklists (R3-6);
  - missing tests for the new Goodnight rules (R3-7).

  None blocks the milestone; fix them now or log them as Known issues.

| Severity | Open (new) | Open (carried) |
|---|---|---|
| S1 | 0 | 0 |
| S2 | 0 | 0 |
| S3 | 7 (R3-1 … R3-7) | R-M10-R2-2 (in Known issues), R-M10-9 → M14 |
| S4 | 5 (R3-8 … R3-12) | as listed in re-review 2 |

## Earlier findings touched by this diff

| ID | Sev | Status | Evidence |
|---|---|---|---|
| R-M10-7 | S3 | ⚠ **Partly reopened** → R3-2 | `usedBlocks` dropped Sleep because nothing checked it in. Now every Goodnight starts Sleep, so Sleep is "used" again. In the SPEC flow it is almost never a success, so "Needs love: Sleep" returns. |
| R-M10-17 | S4 | ✅ Fixed | The heatmap now has a Less → More colour key (`StatsScreen.tsx:354-360`). |
| R-M10-R5 (tick values) | S4 | ✅ Fixed | `timeAxis` puts ticks on whole hours (or half hours for a tight range). Measured at 390 px in TH dark: `7:00 … 10:00`, nothing clipped. |
| R-M10-R2-3 | S3 | ✅ Mostly fixed | The G3 row now says the screenshots were taken after the redesign. Other numbers in the report are stale (R3-12). |
| "Sleep / Perfect day" (Known issue since M3) | S3 | ✅ Closed by `b554c44` | The cap rises from about 73% to about 86% with a ritual at Down Time, or 100% with Goodnight at bedtime. The cost is R3-1 and R3-2. |

## New findings

| ID | Sev | Where | Failure scenario | Suggested fix |
|---|---|---|---|---|
| **R-M10-R3-1** | S3 | `lib/today/useToday.ts:498-508`; `components/night/NightRitual.tsx:299`; `TodayScreen.tsx:141` | **In the SPEC flow, Sleep gets a start that is too early, and the real one can't be recorded later.**<br>• SPEC §4.1 starts the ritual at Down Time. The app auto-offers it there, and Down's first-10 is "10 min free phone → start Night ritual".<br>• So Goodnight usually lands about 15 min into a 90-min Down, roughly **75 min before Sleep's planned start**. `goToBed` stamps `started_at` = Goodnight, so Sleep is "partial", never on time.<br>• "Never moves a start" then blocks the only other route: Today hides the Sleep card, and **Start** in the full-day list is a no-op because `started_at` already exists. A user who really goes to bed on time can no longer log it. Before `b554c44` they could, from the full-day list.<br>• DECISIONS accepts that "an early Goodnight" isn't on time. It doesn't say that the early start is the default path, or that it locks out the real bedtime.<br>• Related: a **late** Goodnight (result "late", no ticket, up to wake − 1 h) still starts Sleep and ticks its first-10, giving the day Quality credit for a ritual the server judged out of time. | Pick one and log it in DECISIONS:<br>(a) If Goodnight is more than 10 min before Sleep's planned start, tick only the first-10 and leave `started_at` empty. Then show a one-tap "Going to bed" on Today during Down after the ritual, or start Sleep automatically at the planned bedtime if the app is open.<br>(b) Keep the current rule, but let Sleep's start be re-stamped once, live, while Sleep's planned start is still ahead. That needs a server rule, because the guard re-checks `started_at` changes.<br>Either way, skip `goToBed` when `complete()` returns `in_time === false`, or tick only the start. |
| **R-M10-R3-2** | S3 | `lib/stats/stats.ts:15-17` (`usedBlocks`); `StatsScreen.tsx:442,453-454` (highlights), `:97` (weekly review); heatmap | **Sleep turns into the weekly "Needs love" again** (R-M10-7 regression).<br>• One Goodnight makes Sleep "used" across the whole 28-day window.<br>• Every **pre-rollout** day then counts Sleep as a **miss**: no log is a miss.<br>• Every early-Goodnight day (R3-1) counts it as **partial**. Neither is a success, so Sleep's rate is about 0%.<br>• `weekSummary` picks the lowest rate. Ties go to the earlier block, and only Down comes before Sleep. So both the Overview's "Needs love" and the weekly review's "Worst" become **Sleep** for any ritual-at-Down user whose Down isn't also at 0%. The heatmap's Sleep row is empty for everyone.<br>• This is the headline card of the redesign, and it tells users who follow the app's own flow that Sleep "needs love". | Judge Sleep on what Goodnight can prove:<br>• count Sleep as a success when its first-10 was ticked live (or when it was started at all), **or**<br>• leave Sleep out of best/worst and the heatmap until R3-1 is settled.<br>Also count Sleep only from the first day it was logged (the rollout date), so older days aren't misses. Add a unit test: a window with Sleep partial every day and other blocks at 50% → worst ≠ sleep. |
| **R-M10-R3-3** | S3 | `StatsScreen.tsx:445,503-508` (Overview tile); `:210` (WakeChart takeaway); `:277-295` (Regularity) | **Two different "±n min" for wake-up, and the Overview tile doesn't say it is weekdays only.**<br>• The Overview "Usually up at 07:38 · ±20 min" is the **weekday I-MR σ** (MR̄/1.128) over up to 28 days. When there are fewer than 2 weekday wakes it **silently falls back** to the mixed weekday + weekend series.<br>• On the Sleep tab, "Usually 07:38, give or take 20 min" sits **right above** "Wake-up · **All over** · ±43 min", which is the plain SD over the last 7 days, weekends included (preview at 390 px, EN and TH, `g7r3/sleep-*.png`).<br>• So one screen says the wake time is tight and loose at once. A weekday-07:00 / weekend-10:00 sleeper sees "07:00 ±5 min" on Overview and "All over" on the Sleep tab.<br>• Minnie knows SPC and will spot it; a playtest user won't know which number to trust.<br>• Both numbers are correct for SPEC §7. The issue is the labels. | • Overview tile: label it "Usually up at (weekdays)" / "ปกติตื่นราว (วันธรรมดา)". Drop the ± there, or show the 7-day word from Regularity instead. Don't fall back to the mixed series; show "–".<br>• Regularity: rename the tiles to "Bedtime, last 7 days" / "Wake-up, last 7 days, all days", or split weekday and weekend like the chart.<br>• WakeChart: "give or take" is fine, since it describes that chart. |
| **R-M10-R3-4** | S3 | `StatsScreen.tsx:480-499`; `messages/en.json:410`, `th.json` `score.help` | **The Day-score bar strip misreads in three ways.**<br>1. **The "(dark bar)" legend is inverted in dark mode.** Perfect bars use `bg-primary`, which is `#9bcb85`, *light* green, in dark mode. Ordinary bars use `bg-primary-soft`, `#33442d`, *dark*. In the TH dark preview no day is ≥ 80%, yet every bar is "dark" (`g7r3/overview-th-dark.png`).<br>2. **Ordinary bars barely show.** `#dcefd2` on `#ffffff` is 1.21:1, and `#33442d` on `#2d2a25` is 1.36:1, below the 3:1 for graphics in WCAG 1.4.11. The per-day values exist only as bar height, and the `role="img"` label gives only the average, though it says "for each of the last 7 days".<br>3. **No data looks like 0%.** A Vacation/Sick day, a day before sign-up, or a missing day draws the same 6% stub as a 0% day. On day 3, a new account sees four "terrible" days. | • Say "the full green bar" / "แท่งเขียวเต็ม" instead of "dark", or use a token pair that keeps the same order in both themes.<br>• Give ordinary bars a fill with at least 3:1 against `--ui-surface` in both themes (e.g. `color-mix(primary 45%, surface)`), and keep a distinct look for Perfect.<br>• Draw no-data days as an empty dashed outline (as the streak calendar does) and put each day's value in the aria label, e.g. "Mo 64%, Tu no data, …". |
| **R-M10-R3-5** | S3 | `messages/en.json:410` (+ TH); `StatsScreen.tsx:488` | **"80% or more is a Perfect day" leaves out half the rule.** A Perfect day (SPEC §8.7, `isPerfectDay`) also needs a minimum day: an in-window "I'm up" plus the Night ritual. A day at 85% with a late wake or no ritual gets the Perfect bar, while the Days tab's streak calendar shows the same day as Missed or merely Kept. That is wrong wording for the number shown, and it also contradicts the weekly review's "Perfect days" count. | Colour the bar with `isPerfectDay(d)`, not `oee ≥ 0.8`. Or keep the threshold colour and reword: "80% or more counts toward a Perfect day (with I'm up and the Night ritual)". |
| **R-M10-R3-6** | S3 | `lib/today/useToday.ts:355` via `goToBed` | **A Sleep checklist now counts against the day.**<br>• `upsertLog` writes `items_planned = checklist.length` on Sleep's new log. Before, Sleep had no log, so its checklist never counted.<br>• Nothing on Today or in the ritual shows Sleep's checklist; it is only reachable through "See the whole day".<br>• Example: a user adds two items to Sleep in Plan (e.g. "brush teeth", "skincare"), with 6/6 elsewhere done → Performance 6/8 → Day score ≤ 0.857 × 0.75 ≈ 64%. A Perfect day becomes unreachable again, which is the problem this commit set out to fix. | Show Sleep's checklist on the Goodnight step (it's the natural place). Or don't count Sleep's items until the user opens Sleep. Or log it as accepted and steer bedtime-routine items to Down in the Plan UI. |
| **R-M10-R3-7** | S3 | `tests/e2e/night-plan.spec.ts:76-82`; no unit test | **The Goodnight rules have no tests.** The only new assertion is the happy path: started, first-10, not backfilled. Nothing covers what the DECISIONS entry promises:<br>• an existing start is kept;<br>• an existing first-10 is kept;<br>• a miss reason is never overwritten;<br>• first-10 off means start only;<br>• the checkbox label follows Sleep's first-10, with a custom text and with it off.<br>`goToBed` is pure decision logic inside a hook, so it's easy to regress. | Pull the decision out into a pure `goToBedPatch(cur, first10)` in `lib/today/` that returns `null | {first10_at?}`, and unit-test those 5 cases. Add one E2E for a pre-started Sleep: its `started_at` is unchanged after Goodnight. |
| R-M10-R3-8 | S4 | `useToday.ts:502-507` | (a) A Goodnight that only adds the first-10, because Sleep was already started, logs `block_started`. One that does both logs only `block_started` and never `first10_done`, so event-based analytics undercount first-10s.<br>(b) The R3-1 note about a late Goodnight. | Log `first10_done` when the patch adds `first10_at`, and `block_started` only when it adds a start. Two events are fine. |
| R-M10-R3-9 | S4 | `NightRitual.tsx:74,299` | Step 3 can move tonight's bedtime ("15 min later"). That changes D+1's plan, and so Sleep's `start`. `sleep` comes from the `timeline` prop, which refreshes only after the realtime `day_plans` echo and a refetch. On a quick Goodnight, or with the realtime channel down (iOS background), `planned_start` is written from the **old** bedtime and kept forever (`current.planned_start ?? b.start`), so on-time is judged against a bedtime the user moved. | At Goodnight, rebuild the Sleep block from the ritual's own `usePlan` ctx (`timelineFor(plan.ctx, timeline.date)`), which already holds the saved edit. |
| R-M10-R3-10 | S4 | `lib/stats/stats.ts:261-268`; `en.json:408` | (a) "+9% vs the 7 days before" is a difference in **percentage points**; IG-style "+9%" reads as relative change (from 40% to 49% is +22.5%).<br>(b) `before` may rest on a single day (e.g. on day 8 of an account, or after a Vacation week), but it's still labelled "the 7 days before". | Write "+9 pts" / "+9 คะแนน", or "9 points higher than…". Show the delta only when each side has at least 4 scored days. |
| R-M10-R3-11 | S4 | messages and tests | • "Mostly: Phone (25%)": "Mostly" overstates a plurality. Say "Most often:" / "บ่อยสุด:".<br>• The heat key says "More on time", but a cell counts "on time **or** checklist ≥ 70%" (its own aria-label says so). Say "More done".<br>• `stats.test.ts:229` claims "Today itself is never counted", but no today entry is in the data. Add one with a score that would change `now`.<br>• `stats.spec.ts` runs `expectTouchTargets`/a11y on Overview and Days but not on the Sleep tab (which has the compact Segmented; I measured it at ≥ 44 px).<br>• The `streak.test.ts:260` comment: up at 19:00 → Sleep is about 11:30 the **next** day (+35.5 h), not "two days on". |
| R-M10-R3-12 | S4 | `docs/qa/M10-report.md:6,28,29` | The report is stale after the redesign:<br>• "Day OEE bars with the 80% line": there is no line any more, and no "OEE";<br>• G1 "i18n 746 keys": now 767;<br>• G2 "Unit 268/268": now 273/273.<br>Fill in the G7 row with this re-review. | Update the three lines. |

## Security: the wider window (`20261110010000_block_logs_day_window.sql`)

- **What changed.** The diff against the M9 function is exactly one line (`36 hours` → `48 hours`).
  - `security definer` and `search_path = ''` are kept, every name is fully qualified, and the `revoke` is re-applied.
  - `create or replace` keeps the existing `block_logs_guard` trigger.
- **Is +48 h needed?** Yes. Wake-day D's Sleep comes from D+1's plan and starts before D+1's wake, so it starts before D+48 h. An Out-late return can reach D+1 12:00, putting bedtime past the old +36 h bound. Nothing in D's timeline starts after D+48 h, and nothing starts before D 00:00, so −6 h is slack but harmless.
- **Does it open an exploit?** No. A log is live only if:
  - `date ≥ _wake_day`;
  - its `started_at`, `first10_at` and `closed_at` are within 10 min of server `now()`;
  - and `date ≤ today`.

  For any such date D, `now()` already lies in [D, D+48 h). So a client that sets `planned_start = now()` was already on time for every live log under the old bound wherever the wake-day model allows; only wakes after noon gain hours. The window was never what stops a forged on-time start. It only stops off-day planned starts, and it still does (`+50 h` → backfilled in the new test).
  - Finished wake-days stay backfilled through `date < _wake_day`, which is unchanged (R-M9-4).
  - On-time within a live day stays honor-system, as recorded since M3 (R-M3-14, DECISIONS M9).
  - No ticket, coin or reward path changed. Goodnight's Sleep start is an ordinary client upsert with no new RPC or grant.
- **The integration test** (`streak.test.ts:258-281`) fails on the old bound: sleep at +40 h was backfilled under +36 h. It passes on the new one, and the test doesn't depend on the time of day it runs. I could not run it (no Supabase stack).

## What I verified and how

- **G1 static** (in `/home/user/m6-wt`, read-only):
  - `npx vitest run tests/unit`: **41 files, 273/273 pass**.
  - `npx tsc --noEmit -p .`: exit 0.
  - `npm run -s i18n:check`: "i18n OK — 767 keys in en/th".
  - HEAD `d95d29b`, clean worktree.
- **Diff review:** every hunk of `847a8e0..d95d29b`.
- **Code read alongside the diff:**
  - Stats: `lib/stats/stats.ts`, `useStats.ts`, `lib/game/outcome.ts` (`blockResult`, `dayOee`, `isPerfectDay`).
  - Goodnight → Sleep: `lib/today/day.ts` (`timelineFor`: Sleep is tonight's, from D+1's plan, logged under D), `upsertLog`, `useBlockText.first10`, `content/blocks.ts` defaults.
  - Server rules: the M9 `block_logs_guard`, `_wake_day`, `_day_oee` and `_block_result`.
- **i18n:** EN and TH have identical key sets. Plurals use ICU in EN; the plain TH forms are correct for Thai. There are no hardcoded strings in the new components (only "–" and "%"). "Day OEE" is gone from messages, and `review.oee` and the `stats.oee.*` keys have no remaining callers.
- **Visual:**
  - I unpacked `git archive d95d29b` into the scratchpad with hardlinked `node_modules` and ran `next dev` on :3998 with dummy Supabase env. It must be opened via `localhost`; `127.0.0.1` is blocked by `allowedDevOrigins` and doesn't hydrate.
  - I drove it with Playwright Chromium at 390×844, touch and mobile: `/dev/stats?tab=overview|sleep|days`, EN light and TH dark.
  - Results:
    - No horizontal scroll on any tab.
    - No button or radio under 44 px on any tab.
    - The wake chart renders 20 weekday and 8 weekend points, both when opened directly and after switching tabs.
  - Screenshots are in `scratchpad/g7r3/*.png` (`overview-th-dark.png` shows R3-4.1; `sleep-en-light.png` shows R3-3).
- **Contrast** (computed from `styles/tokens.css`): see R3-4. Muted text is 5.66:1 light and 7.35:1 dark; the Perfect bar is 5.72:1 and 7.67:1. No near-black colours were introduced.
- **Not run:** E2E and integration (no Supabase or Docker stack in this container).
- **Cleanup:** the dev server is stopped and the scratch app copy is deleted. Only the screenshots and probe scripts remain in `scratchpad/g7r3/`.
