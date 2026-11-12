# G7 independent review: playtest R1 fixes (P1–P9, R1, R2, R3, R5, R7)

- **Reviewer:** fresh QA subagent, with no implementation context.
- **Date:** 2026-11-11.
- **Code reviewed:** checkout `e250722` (`33e90a4..HEAD`).
- **Where it ran:** the app ran at http://localhost:3200 (production build) against local Supabase. Chromium emulated an iPhone at 390×844 (touch, Asia/Bangkok or a per-scenario profile zone) and an iPad in portrait at 810×1080. WebKit was not available.
- **Database resets:** the local DB was reset twice during the review. Each scenario below was re-seeded on a fresh account after the last reset.
- **Fixes not in this checkout:** the running DB already had two later fixes from the builder, so they were not reviewed: a set-aside block is no longer grown by a credit, and the farm-warning line now loads 2 s after the page.
- **Evidence:** scripts and screenshots are in `/tmp/claude-0/-home-user-twentyfour-seven/70c331e7-c8a5-54e2-a6b6-8031bbfe6cac/scratchpad/g7/`. Screenshot names below are relative to that folder.

## Verdict: **FAIL**

There is 1 open S1 and 4 open S2s:
- **S1:** the new one-tap "Today went as usual" turns blocks the person really started on time into backfills, so they earn nothing.
- **S2:**
  - R1's "a first-10 inside the block counts as a start" was never built.
  - An early "I'm up" leaves Today blank.
  - The ritual still offers miss reasons for a Wake that was credited.
  - Away days (and so the welcome-back ticket) can be faked by deleting your own past block logs through the API.

## Findings

| ID | Sev | Where | Steps to reproduce | Expected | Actual | Screenshot |
|---|---|---|---|---|---|---|
| F1 | **S1** | Night ritual, step 2: "วันนี้ทำตามปกติ" (`NightRitual` → `actions.close` → `upsertLog`) | 1. Make a day where Focus was started live, 2 min after its planned start (`backfilled=false`), and Free was started live too. 2. At Down Time, open the ritual. 3. Tap Next, then "วันนี้ทำตามปกติ". | Only **untapped** blocks are logged as backfills (R7: "marks un-tapped blocks as done"). A block started live on time stays a live success and keeps its growth. | All 5 open blocks were saved with `backfilled=true`, including the live Focus start. `_block_result(focus)` went from `success` to `backfilled`, so the Focus plot gets no growth that day, Day score loses the on-time start (`_day_oee` = 0), and a Perfect day is impossible. Cause: `upsertLog` sends `backfilled: true` for every past block, even one that already has a live `started_at`. The per-block "ทำแล้ว" button has had the same bug since before this batch, but R7 now makes it the default path every night. | `night-today-after.png` (timeline shows "บันทึกย้อนหลัง" on every block) |
| F2 | **S2** | R1 rule: first-10 as a start (`lib/game/outcome` `succeeded`, SQL `_block_result`) | 1. While Work has been running for 4.5 h, tick its first-10 on the current-block card. | DECISIONS 2026-11-11 R1: "a first-10 within the block counts as a start" (not "late"). | The label reads "เริ่ม 14:04 · เริ่มช้า". The DB has `started_at` = planned + 4:34 and `_block_result` = `partial` (no growth). No code anywhere implements this part of R1, and it isn't listed as deferred. | `r1-first10-in-block.png` |
| F3 | **S2** | Today after an early "I'm up" (P2) | 1. Set the target wake to 1 h from now; yesterday was an active day. 2. Today shows yesterday's "ไปนอน" card. 3. Tap "ตื่นแล้ว". | The day starts, and Today confirms the wake and its Sunrise ticket, then shows what comes next. An on-time press shows "ตื่น 14:03 ตรงเวลา! +1 ตั๋วเช้า" plus the current block. | Today switches to the new date (P2's core fix works) and the server grants the Sunrise ticket (`in_window=t`). But the screen goes **blank**: no confirmation, no ticket feedback, no current block and no "ถัดไป" line. Only the exercise card is left, at 0.4 s, 1.5 s and 4 s after the tap, with and without reduced motion. This is the "office" persona's exact path. It breaks the §5 rule that every tap gets feedback. | `p2b-press-400.png`, `p2b-press-4000.png` (early) vs `p2c-press-400.png` (on time) |
| F4 | **S2** | Night ritual, step 2, with a credited Wake | 1. Press "I'm up" in the window. 2. At night, open the ritual and go to step 2. | Wake was done (R1: "I'm up" = Wake's on-time start), so it isn't listed among blocks that "ไม่ได้ทำ". | Wake is listed with the six miss-reason buttons. The "เหตุผลเดียวกันทุกบล็อก" row applies a reason to every not-started block, Wake included. A miss reason beats the credit (`blockResult` checks `miss_reason` before `credited`; SQL does the same), so one tap on "ง่วง" turns an on-time wake into a miss and puts weeds on the Wake plot. | `night-ritual-step2.png` |
| F5 | **S2** | Away days and welcome back (`_away_day` reads client-deletable `block_logs`) | 1. Account active on D-3 (wake + ritual), with only a late Work start logged on D-2 and D-1. 2. `welcome_back_status` → `lapsed:false`. 3. With the user's own JWT, `DELETE /rest/v1/block_logs?date=lt.<today>` (RLS allows it): 200. 4. `claim_welcome_back`. | Rewards depend only on data the client can't manipulate (CLAUDE.md: "the client never decides outcomes"). | After the delete, the status is `{"lapsed":true,"away_days":2}` and the claim returns `{"granted":true}` (+1 ticket). The same delete also turns any day's misses into "away" (excused), so weeds, wilt and death can be erased afterwards. Fix: don't let clients delete `block_logs`, or base "away" on something the client can't remove. | n/a (REST; `tWBdel.cjs`) |
| F6 | S3 | Night ritual, step 2 | 1. Double-tap "วันนี้ทำตามปกติ". | The blocks close once and the ritual stays on step 2. | The first tap closes the blocks and the list collapses, so the second tap lands on the backdrop and **closes the whole ritual**. Reopening it starts again at step 1. No data is lost; the blocks were closed. | Seen live; the screenshot was overwritten by a later run. Reproduce with `tC.cjs` using `dblclick` |
| F7 | S3 | Setup wizard (P5) | 1. Double-tap "เพิ่มแบบวัน". 2. Separately: on the week step, go to Today and tap "ตั้งค่าเลย". | No duplicate kinds, and setup resumes at the saved step (P5). | (a) Two kinds, both named "แบบวันที่ 4", are created: the P5 pile-up is still possible. (b) The re-entry opens at step 1 (`/welcome` without `?step`). The resume only works for a same-URL reload, not for an iOS PWA relaunch from `/today`. | `p5-week-after-reload.png` (the reload itself is fine) |
| F8 | S3 | Welcome-back copy | 1. Return after 3 away days. | The copy is true. | "ระหว่างที่ไม่อยู่ไม่มีอะไรเสียหาย / nothing was lost while you were away" is false: the streak settled those away days as `missed` (it is reset, or scarecrows are used up). The goal text says "ในสัปดาห์นี้ / this week", but the rule is 5 days from the welcome. | `wbui2-today.png`, `wbEnDark-after-claim.png` |
| F9 | S3 | Welcome-back economy | Reasoned from the rules, with each part verified: 2 untouched days → lapsed; the cooldown is `ref_date > today-7`. | Welcome back is for real lapses. | Someone who never opens the app at weekends qualifies **every Monday**: +1 welcome ticket, plus +2 for back on track after 3 minimum weekdays. That is +3 tickets a week, and the "Welcome back" card shows weekly. Minnie should decide. | n/a |
| F10 | S3 | Welcome card while offline | 1. Go offline. 2. Tap "เริ่มวันนี้". | A friendly error, with a retry (CJ-16). | Nothing happens and no message shows. Tapping again once online works, with 1 grant only. | `ipad-welcome-offline.png` |
| F11 | S3 | R5 tasks on the current-block card | 1. Double-tap a task row. | It is ticked once. | The first tap completes the task (+10 coins, from the server) and the second reopens it. The row ends **unticked** but "+10 เหรียญ" still shows. Coins are not doubled: complete → reopen → complete gave 1 grant. | `r5-card-after.png` |
| F12 | S3 | Labels for credited blocks (P7/R1) | 1. Press "I'm up" on time. 2. Finish the ritual. | Credited blocks read as done or on time everywhere. | Wake's current card still offers "เริ่ม". After "as usual", Wake reads "บันทึกย้อนหลัง" in the timeline. Down shows "เสร็จแล้ว" in the timeline, but its card still offers "เริ่ม" with an unticked first-10. | `p2c-press-4000.png`, `night-today-after.png` |
| F13 | S3 | "One more miss" warning on Today (R2) | 1. Open Today with a plot at 4 misses. | The warning is visible, because the plant dies tomorrow. | On iPhone (390×844) it sits below the wake card, the current block and the exercise card, off the first screen. | `wbui2-today.png` (not visible), `wbEnDark-after-claim.png` (at the fold) |
| F14 | S3 | Welcome card vs the wake card | 1. Return in the morning. | One clear first action (R3: "one 'start today' tap"). | "เริ่มวันนี้" (claim the gift) and "ตื่นแล้ว" are both big primary buttons. "Start today" starts nothing; it only claims the gift. If the person just presses "I'm up" and ignores the card, the gift is gone the next day (`lapsed` is computed from yesterday back). | `wbui2-today.png` |
| F15 | S3 | P1 vs R2 (code) | 1. Have a template that squeezes a block to 0 min. 2. Open Today without logging anything. | DECISIONS R2: "Opening the app without logging anything still counts as away". | `setAside` upserts a `block_logs` row as soon as Today loads, and `_away_day` treats any `block_logs` row as activity. So for these users, opening the app turns an away day into a judged day, where every other block is a miss. P1 also only works if Today was opened that day. | n/a (code: `useToday` `setAside` effect + `_away_day`) |
| F16 | S4 | Setup checklist (P8) | 1. Fresh account on a Thai device (auto-detected, nothing tapped). | — | "เลือกภาษา 5 เหรียญ" stays open even though the app is already in Thai. Tapping the already-selected "ไทย" in More credits it. | `p8-more-autodetect.png` |
| F17 | S4 | R7 wording | 1. Open ritual step 2. | — | The header still asks "ช่วงไหนไม่ได้ทำ?", the failure-first framing R7 was meant to remove. The one-tap button sits under it. | `night-ritual-step2.png` |
| F18 | S4 | Welcome when returning before the wake (code) | 1. Return before today's target, without pressing "I'm up". | — | `_wake_day` is still yesterday, so `ref_date` = yesterday. That day can never become a minimum day, so the "3 of 5 days" goal is really 3 of 4. | n/a |

## Conformance

| Item | Result | Evidence |
|---|---|---|
| P1 0-min block not missed | **PASS** (code and unit tests; not reproduced live) | The fix sets `planned_deviation` → `excused` and the timeline shows "ไม่มีในวันนี้". See F15 for how it interacts with away days. |
| P2 early "I'm up" starts the day | **PASS on rules / FAIL on UX** | `_wake_day` returned the new date right after the press, and the date label flipped from 10 to 11 Nov. Today is then blank (F3, S2). |
| P3 the task editor's finish button | **PASS** | The item sheet's buttons are "ปิด / … / **ทำงานนี้เสร็จแล้ว** (secondary, with a check icon) / เอาออกจาก backlog". |
| P4 raw first-10 keys | **PASS** (code) | `editableFirst10` is used in `DayEditor`. No "@s:" in the rendered text of Today, Plan, Farm, Stats or More (TH) after "ใช้ที่แนะนำทั้งหมด". I couldn't reach the editor's own field in the browser. |
| P5 setup wizard reload | **PARTIAL** | A reload resumes at `?step=week` and `?step=first10`, and re-applying a starter upserts, so kinds aren't duplicated. A double-tap on "เพิ่มแบบวัน" still duplicates, and re-entry from Today restarts at step 1 (F7). |
| P6 early start isn't "late" | **PASS** | Starting Wake 60 min early shows "เริ่ม 12:21 · เริ่มก่อนเวลา". |
| P7 wake card vs Wake block | **PARTIAL** | Wake reads "เสร็จแล้ว" when credited. The labels still disagree in places (F12). |
| P8 Thai device → Thai login; language pick credited | **PASS** | On th-TH the login page is in Thai (`lang=th`); on en-US it is in English. Picking ไทย at login logs `locale_changed{from:login}`, shows "รางวัลการตั้งค่า 5 เหรียญ" and sets setup to 1/7. See F16. |
| P9 Thai words; iPad layout | **PASS** | In the TH text of Today, Plan, Farm, Stats, More, the ritual and the plot sheet: no "Template", "Down Time", "Gradation", "Sunrise", "Night ritual", "first-10" or "Sleep เริ่ม". New terms in use: "รูทีนก่อนนอน", "พักก่อนนอน", "เปลี่ยนโหมด", "ตั๋วเช้า"/"ตั๋วกลางคืน", "10 นาทีแรก". On the iPad (810 wide) the column is centred, the sheet is centred (512 px wide) and nothing scrolls sideways. Plot labels wrap onto 2 lines ("พักก่อน / นอน"). 12-hour time inputs were left as they are, by decision. |
| R1 lived actions credited | **FAIL** | An in-window "I'm up" credits Wake, and the ritual's Night ticket credits Down (timeline "เสร็จแล้ว"). In the farm, the Wake plot grew over 4 credited days. The first-10-as-start part is missing (F2, S2), and a credited Wake can still be turned into a miss in the ritual (F4, S2). |
| R2 away days pause the farm; last-chance warning | **PASS** (with F5, F13, F15) | Plot at 4 misses, then 3 untouched days: not dead. Today shows "มะเฟืองที่แปลงงาน พลาดอีกวันเดียวจะตาย". The sheet shows the last-chance alert above the weeds and wilt notes. Away days have no Day score. |
| R3 welcome back | **PASS on server rules** (with F5, F8–F10, F14) | `welcome_back_status` gives lapsed=true for 3 away days, false for a new account (null run), false for 1 away day, false when yesterday was active. Six parallel `claim_welcome_back` calls → exactly 1 grant (+1). Repeat claim → false. UI double-tap → 1 grant. `claim_back_on_track` → false at 0 and 2 days; at 3 days, 4 parallel calls → 1 grant (+2). Anon calls to all 3 RPCs → 401 `permission denied`. `_away_run` and `_grant_once` → permission denied. A direct `ticket_grants` insert → RLS 403. A `game_state` PATCH → 0 rows. |
| R5 tasks on the current block | **PASS** (F11) | Shows today's tasks for that block (including a block-less task → Work), not other blocks' or yesterday's. Long Thai titles wrap and nothing scrolls sideways. Ticking pays coins from the server (+10; `coin_grants` +1). Touch targets are ≥ 44 px. |
| R7 "Today went as usual" | **FAIL** | One tap closes all open blocks and grants no tickets: only the Sunrise and Night grants exist. It also strips the live success from blocks that were started (F1, S1), and a double-tap closes the sheet (F6). |

**Server-side safety (G5):**
- All three new RPCs are `security definer` with `set search_path = ''` and check `auth.uid()`.
- Execute is revoked from anon, and the helpers are revoked from authenticated too.
- The grants are idempotent through the `(user_id, reason, ref_date)` primary key, and they held under a race.
- The only gap found is F5: rules read `block_logs`, which the client can delete.

## UX budgets
- **Night ritual on a normal day with "Today went as usual": 7 taps.**
  - When it auto-opens at Down Time, the taps are: Next → as usual → Next → Next (plan) → alarm checkbox → Goodnight → Done.
  - Opened from Today's "เริ่มรูทีนก่อนนอน" button, it takes 8 taps.
  - About 15–20 s of interaction, so R7's "< 30 s" goal is met.
- **Welcome back: 1 tap** ("เริ่มวันนี้", +1 ticket at once). Back on track is 1 more tap once 3 days are reached.
- **Touch targets:** every new control measured was ≥ 44 px (task rows 48 px, the as-usual button 48 px, the warning line 44 px).
- **Feedback:** fails for an early "I'm up" (F3) and for an offline welcome claim (F10).

## Rubric (new UI: the welcome card, the goal card, the warning line, the plot-sheet alert, the as-usual button, task rows; TH and EN, light and dark, iPhone and iPad)

| # | Score | Note |
|---|---|---|
| R1 Style | 4 | Flat, token colours, no outlines. The new UI is plain cards, consistent with the rest of the app. |
| R2 Consistency | 4 | The new cards reuse the existing card, button and warn-soft styles. A "must" task row uses the same yellow as the first-10 row, so they look alike. |
| R3 Readability | 4 | Thai and EN read clearly at 390 px. The crop art is unchanged. |
| R4 Layout | 4 | No sideways scroll at 390 or 810, and the iPad column and sheet are centred. The warning line is below the fold (F13). The welcome card and wake card stack as two big CTAs (F14). |
| R5 Typography | 4 | Thai line-height is fine and a long task title wraps cleanly. There are 3 sizes on the cards. |
| R6 Colour & contrast | 4 | Dark mode is deliberate. The warn-soft line is readable in light and dark. |
| R7 Motion | 4 | Nothing new animates. Reduced motion was respected in the runs. |
| R8 Delight | 3 | The welcome gift and the +2 goal are a single text line, with no reward moment, sound or ticket animation. The early-wake path gives no feedback at all (F3). |
| R9 Not AI-looking | 4 | No emoji in the new strings or components: the ✓ in the proposal became `CheckIcon`, and there are no hard-coded strings. |

**Art-rule violations:** none found. The new components have no black strokes, no emoji and no hard-coded user-facing strings; every new string exists in both `en.json` and `th.json`.

## Top 3 improvements
1. **Fix R7 and close-block backfilling (F1).** When a block already has a live `started_at`, closing it must not send `backfilled: true`; only the never-started blocks should be backfilled. Add a failing test first: a live on-time Focus, then "as usual", then `_block_result` = success. Also take credited blocks (an in-window Wake) out of the ritual's "not done" list and out of the bulk miss reason (F4).
2. **Finish R1 and the early-wake Today (F2, F3).**
   - Build "a first-10 inside the block counts as an on-time start" in both TS and SQL, or log it in DECISIONS as deferred.
   - After an early "I'm up", show the wake confirmation with its ticket, and a "Next: Wake 13:21" or current-block line.
3. **Make "away" tamper-proof and honest (F5, F8, F9).**
   - Stop clients deleting `block_logs`, or derive away days from append-only data.
   - Fix the "nothing was lost" / "this week" copy, or pause the streak on away days.
   - Have Minnie decide whether weekly 2-day gaps should earn a welcome back every week.

## Re-review (85adfe6)

- **Reviewer:** same G7 reviewer.
- **Date:** 2026-11-11.
- **What ran:** checkout `85adfe6`, local DB with migrations through `20261111060000`, fresh accounts, iPhone 390×844 emulation.
- **Server restart:** when I started, the server on :3200 (PID started 19:03) was still serving the build from before the 19:22 rebuild. Its chunks returned 500 and the pages rendered blank. I restarted it with `next start -p 3200` from this checkout, and every check below ran on the rebuilt app.
- **Scripts:** the same scripts in the scratchpad `g7/` folder: `tC2.cjs`, `tR1f.cjs`, `tP2b.cjs`, `tF5.cjs`.

### Verdict: **PASS**. No open S1/S2.

| ID | Status | Evidence (same repro as the first review) |
|---|---|---|
| F1 (S1) | **Fixed** | Focus was started live 2 min after its planned start, then "วันนี้ทำตามปกติ" was tapped. Focus stays `backfilled=false` with `_block_result` = **success**, and its timeline label is "เสร็จแล้ว". Free (started live but late) stays live as `partial`. Only the never-started Work and Gradation are backfilled. Tickets: only Sunrise and Night. The guard now keeps a live start live on a late close, and a block first started after it ended is still a backfill. |
| F2 (S2) | **Fixed** | First-10 ticked 4 h 58 min into Work: the label reads "เริ่ม 14:28 · เริ่มด้วย 10 นาทีแรก" and `_block_result` = **success**. This matches TS `startCounts`. |
| F3 (S2) | **Fixed** | "ตื่นแล้ว" pressed 60 min before target: right away Today shows "+1 ตั๋วเช้า", the card "ตื่น 14:28 ตรงเวลา! +1 ตั๋วเช้า" and "ถัดไป: ตื่น · 15:28", still there after 4 s. An on-time press behaves as before. |
| F4 (S2) | **Fixed** | With an in-window "I'm up", ritual step 2 lists Focus, Work, Gradation and Free, not Wake. "เหตุผลเดียวกันทุกบล็อก → ง่วง" set `miss_reason` only on Work and Gradation (the not-started ones). Wake got no row and stays credited ("เสร็จแล้ว" on the timeline). |
| F5 (S2) | **Fixed** | `DELETE /rest/v1/block_logs` as the user returns **403** (`42501`), and all 3 rows remain. Status stays `lapsed:false`; `claim_welcome_back` → `granted:false`. Moving a log's date by PATCH is refused (`22023`). No app code deletes `block_logs`, so the change doesn't break anything. |

**S3s fixed:**
- **F6:** a double-tap on "Today went as usual" no longer closes the sheet (the dialog stays open).
- **F8:** the copy is now true: "ระหว่างที่ไม่อยู่ ต้นไม้ไม่เหี่ยวไม่ตายเลย", and the goal says "ภายใน 5 วัน" / "in the next 5 days".
- **F9:** 2 away days (a weekend) → `lapsed:false`, `granted:false`. 3 away days → `lapsed:true`, `granted:true`.

**Still open (S3/S4, from the first review):**
- **F7:** a double-tap on "เพิ่มแบบวัน" makes duplicate kinds, and re-entering setup from Today starts at step 1.
- **F10:** tapping the welcome claim while offline shows no message.
- **F11:** a double-tap on a task row re-opens it while the coin line stays.
- **F12:** partly fixed. Wake now reads "เสร็จแล้ว", but after the ritual Down's current card still offers "เริ่ม".
- **F13:** the last-chance line is below the fold on iPhone.
- **F14:** the welcome card and the wake card are both big primary buttons.
- **F15:** P1's set-aside row makes an untouched day non-away.
- **F16–F18:** the S4s.

**New:**
- **S4:** an early "I'm up" (60 min before target, inside the 3-hour honour window) is labelled "ตรงเวลา!". That matches how the ticket is judged, but reads oddly.
- **S4:** the `day_keys_guard` message still says "delete it and add it again", though clients can no longer delete. It's server-side only and not shown in the UI.

No new S1/S2 found in the nearby paths I checked again:
- the ritual with "same reason for all";
- double-taps;
- welcome claim races and thresholds;
- the current-block first-10 label;
- the early-wake card.
