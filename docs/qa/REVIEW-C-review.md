# Review fix Phase C — G7 independent review

- **Scope:** `git diff b30221f..2f6ef9b` on `review-c-local`: commits `4a9839f` (C1), `c7a7be5` (C4, migration), `578b17b` (C2), `75cd342` (C3), `2f6ef9b` (C5). The later `5e68357` (DECISIONS only) was read for context.
- **Reviewer:** a fresh G7 subagent with no implementation context.
- **Date:** 2026-11-20.

## Verdict: FAIL

There are 2 S2 findings and no S1. The migration and the economy are safe. Only `_setup_reward` is replaced, the ledger still pays each reward once, and no path pays extra tickets. The two S2s are both on Today:

- **R-C-1:** the new "+ Pick a first step" and "+ Add a checklist item" controls overwrite the block's **default** (every future day) when the block is empty only for today. That happens after "None" today, a day with its checklist removed, or a kind of day with its own empty value. The change also never shows on today's card, so the control stays and invites more overwrites.
- **R-C-2:** the farm strip appears about 2 s after Today at the top of the page, so "I'm up" and the check rows jump 60 px under the user's finger.

There are also 11 S3 and 7 S4 findings.

## What I ran
| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| ESLint on the 15 changed code and test files | clean |
| `i18n:check` | 1283 keys, EN = TH |
| `npx vitest run` first-day, unlocks-sql, unlocks, integration setup-rewards | 4 files, 12/12 pass (the integration test now expects 2 tickets) |
| Local DB, read-only | `_setup_reward('sleep_times')` = `{"seed": {"n": 2, "crop": "strawberry"}, "tickets": 1}`. ACLs after `create or replace`: `_setup_reward` and `_grant_unlock` have no `authenticated` execute; `claim_setup_rewards` does. |
| E2E / Playwright, build, servers | **Not run** (as instructed). Layout, cutscene and timing findings come from reading the code. |

## Findings

### R-C-1 (S2) The in-place first step and checklist overwrite the default when only today is empty
- **Where:** `components/today/BlockCheckin.tsx:204–213` (picker shown whenever `first10Text` is null), `:231–238` (checklist field shown whenever `block.checklist` is empty); `lib/today/useToday.ts:666–673` (`setBlockDefault` writes `settings.blocks`, and for the checklist it writes `[newItem]`, which **replaces** the default list).
- **Why:** `blockMeta` (`lib/today/day.ts:188–196`) resolves a block's values in this order: day override, then the kind of day (template), then the settings default. An empty value at a higher level hides the default. "Empty on today's card" therefore does not mean "the default is empty":
  - The swap chooser on the same card offers **None** (`NONE = ""`), which writes `overrides.blocks[key].first10 = ""` for today. `text.first10(key, "")` is `null`, so the card now shows "+ Pick a first step".
  - Plan's DayEditor (`components/plan/DayEditor.tsx:319`) removes checklist items for one day. Removing the last one stores `checklist: []` for that day, so the card shows "+ Add a checklist item".
  - A kind of day can carry its own `first10`/`checklist` per block, with the same effect.
- **Failure scenarios:**
  1. Focus's default first step is her own "Open the notes". Today she picks None ("not today"). The card now says "+ Pick a first step". She taps it and picks a suggestion. Her own text is **replaced in settings for every future day**. Today's card is unchanged, because the `""` override still wins. `FirstStepPicker` also never leaves its `"saving"` state on success, so its buttons stay disabled.
  2. Her Work default checklist has 5 items. In Plan she clears today's list (a holiday). On Today she types one item for today and taps Add. Her **5-item default becomes this single item**. Today still shows the empty field, so a second item replaces the first one again.
- **Fix:** offer the in-place editors only when the default itself is empty. Pass the resolved source, or check `ctx.blocks` / template / override in `useToday` and expose `canSetDefault(block)`. Where an override or template value hides the default, keep the old text, or write to the same level (the day override) instead. For the checklist, append to the stored default (`[...base.checklist, item]`) instead of replacing it. Reset the picker's state after a successful save.
- **Failing-test idea:** unit test on a pure `defaultEditable(ctx, date, key)`: false when the day override has `first10: ""` or `checklist: []` while settings has values. E2E: set Focus's default `first10` to an own text, then choose None on Today; expect no "+ Pick a first step" and the default unchanged in `settings`. Then give Work a default checklist of 2 items and a day override `checklist: []`; expect no "Add a checklist item" field, and `settings` still has 2 items.

### R-C-2 (S2) The farm strip pops in at the top 2 s after Today and moves what the user is tapping
- **Where:** `components/today/TodayScreen.tsx:91` (`useFarm({ live: false, delayMs: 2000 })`), `:230` (`<FarmStrip>` right under the header, above the welcome, wake and current-block cards); `components/today/FarmStrip.tsx:18` (`if (!data) return null`).
- **What happens:** Today renders, and the user reaches for "I'm up" or a check row ("one tap from launch", CJ-03). About 2 s after mount, plus one round trip, the strip appears: a 48 px link plus a 12 px margin, inserted above everything. Every card jumps 60 px down. The 2 s delay was chosen for `LastChanceLine`, which sits near the bottom, where a late arrival moves nothing that matters.
- **Failure scenario:** she opens the app and taps "I'm up" at about 2 s. The tap lands 60 px higher in the new layout. It hits the strip (the farm opens, no wake is recorded and the in-window ticket may be missed), or it hits the row above a checklist item and ticks the wrong item. It also adds layout shift on every Today load (Lighthouse CLS, G6).
- **Fix:** reserve the strip's space on phones from the first render. Draw the sky and the empty ground at once (or a placeholder of the same size) and fill in the plots when `farm.data` arrives. Another option is to place the strip below the main card. Keep the delay for the request only.
- **Failing-test idea:** E2E at 390 px: record the "I'm up" button's bounding box right after `See the whole day` is visible, wait 3 s (or until the strip is visible), and expect the same `y`.

### R-C-3 (S3) The first capsule opens before Som's first scene, and the scene then covers it
- **Where:** `components/farm/FarmScreen.tsx:95` (`openCapsules={capsuleAsked && !story.playing}`), `:161–166`.
- **What happens:** every new account has `ch0_gate` (trigger `always`) waiting for its first calm farm visit. `useStory` needs `getSession`, then `story_status`, then the claim RPC before `playing` is set. `useGacha` needs one parallel round trip. So when the user arrives from "Open your first capsule", the tickets usually arrive first and the capsule sheet opens (z-50). A moment later the cutscene starts on top of it (`Cutscene` is `fixed z-[60]`). That gives two `role="dialog"` layers at once, against the comment "never two sheets at once". The E2E test signs in with `story: false`, so it never sees this.
- **Fix:** wait until the story has answered, not just "not playing now". For example, have `useStory` expose `settled` (no beat, or the beat finished) and open the sheet on `capsuleAsked && story.settled && !story.playing`.
- **Test idea:** onboarding E2E with `story: true`: after "Open your first capsule", expect the cutscene first and no "Capsule machine" dialog; skip the scene; then expect the machine.

### R-C-4 (S3) "Open your first capsule" gives no feedback while it claims, and does nothing when there's no ticket
- **Where:** `components/onboarding/Onboarding.tsx:190–203`; `FarmScreen.tsx:161`.
- **What happens:**
  - The button awaits `claim_setup_rewards` with no busy state. The client's timeout is 15 s (`fetchWithTimeout`), so on a slow network the tap does nothing visible, and repeated taps queue several pushes.
  - On `/farm`, the sheet opens only when `tickets > 0`. If the claim failed, the user is offline, or the reward was already claimed and spent, nothing happens and no message explains why. `?capsule=1` also stays in the URL, so a later ticket arriving during the visit (the farm reloads) pops the machine open unexpectedly.
- **Fix:** disable the button and show "Opening…" while it works. On the farm, once `gacha.state` has loaded, always clear the param. With 0 tickets, open the sheet anyway: its own "how to earn" line explains the situation.

### R-C-5 (S3) `setBlockDefault` writes the whole `settings.blocks` from a possibly stale copy
- **Where:** `lib/today/useToday.ts:667–669`.
- **What happens:** the new array is built from `loaded.ctx.blocks` as last loaded. It is not updated optimistically: `setReload` refetches afterwards.
  - On the same card: she picks a first step and adds a checklist item before that reload has finished (slow network). The second write is built from the old blocks, so it puts `first10` back to `null`. The ticket was already paid, and the step she picked is gone.
  - Across devices: Today has been open on the iPad since the morning. She changes block lengths in Plan on her phone, then adds a checklist item on the iPad's Today. The phone's edits to the other blocks are reverted.

  Plan's `saveBlockDefault` has the same whole-array pattern, but it updates `ctxRef` first.
- **Fix:** at least update `loaded.ctx.blocks` optimistically before writing, as Plan does. Better, for both screens: a small RPC that replaces one block's keys inside `settings.blocks` on the server (`jsonb_set` on the matching element), so one block's edit never rewrites the others.

### R-C-6 (S3) A morning sign-up's "first day" ends at their first "I'm up", minutes after joining
- **Where:** `lib/today/firstDay.ts:8–10`; unit test "Made after midnight but before the wake: still the day before's wake-day".
- **What happens:** the first day is the wake-day that contains `created_at`. If she signs up at 09:00 with a 10:00 wake, the account belongs to *yesterday's* wake-day. She sees the folded screen only until she taps "I'm up" at 09:50, and then gets the full screen for the whole of her real first day. Also, `isFirstDay` uses today's plan, so changing the wake time during onboarding can move the sign-up into a different wake-day. The plan's wording is met; its goal (the first day a person lives through keeps to one thing) is not met for anyone who joins before their wake time.
- **Fix:** count the first day as the wake-day of `created_at`, plus the following wake-day when the account was made less than about 12 h before that next wake. Or ask Minnie and log the rule in DECISIONS.

### R-C-7 (S3) The farm strip overflows on phones narrower than about 372 px
- **Where:** `components/today/FarmStrip.tsx:26–41`.
- **What happens:** the content is Som (44, `shrink-0`) + 7 plots × 40 px (each inside a `<span>` flex item whose minimum width is its 40 px content) + `px-2` (16) = **340 px**. The container is the viewport minus `mx-4` (32 px). At 375 px it fits with 3 px to spare. At 360 px (most Android phones) the Sleep plot is cut by 12 px. At 320 px about 52 px is cut, more than a whole plot. `overflow-hidden` on the link hides the overflow instead of scrolling, so the page check stays green while the plot is missing.
- **Fix:** let plots shrink (`flex-1 min-w-0 max-w-10` with `aspect-square`), or hide Som below about 380 px.
- **Test idea:** at 360 × 740, expect every `[data-plot]` box to lie inside the link's box.

### R-C-8 (S3) The strip never changes after a check-in on Today
- **Where:** `TodayScreen.tsx:91` (`live: false`, loaded once).
- **What happens:** plot stages come from `block_logs` (`lib/farm/useFarm.ts:89`). Ticking the first step or closing a block does not reload the farm, so the strip shows this morning's stage until she leaves Today. The component's own doc says the point is "so a check-in visibly grows something". (The first-10 sparkle is deferred, per DECISIONS.)
- **Fix:** expose `farm.reload` and call it, debounced, after Today's check-in actions, or after `setReload` in `useToday`. It is one extra read per check-in at most.

### R-C-9 (S3) The Thai hint keeps "Night ritual" in English
- **Where:** `messages/th.json:604`: `"down": "วางจอ แล้ววางแผนพรุ่งนี้ใน Night ritual"`.
- **What happens:** everywhere else the Thai UI calls it **รูทีนก่อนนอน** (`night.title`, `night.start`, `streak.ruleMinimum`), so a Thai reader sees an English term only here.
- **Fix:** `"วางจอ แล้ววางแผนพรุ่งนี้ในรูทีนก่อนนอน"`.

### R-C-10 (S3) On the first day, the setup hint is outside the fold, and the order differs from the plan
- **Where:** `TodayScreen.tsx:399` (`TodaySetupHint`, below the fold) and `:230` (the strip first).
- **What happens:** the plan for C1 says the setup hint goes inside "More today", and the order is setup → current block → farm strip. On day 1, after onboarding, the bottom of Today still shows the setup hint card, a second thing to do. The strip comes first. Neither change is in DECISIONS.
- **Fix:** move `TodaySetupHint` inside `FirstDayFold`, or log why it stays out.

### R-C-11 (S3) The 26 h default in the test helper hides the real new-user journey and changes what `settle_days` does
- **Where:** `tests/helpers/auth.ts:64–74`.
- **What happens:**
  - Every spec except `first-day.spec` now runs on a day-old account. `onboarding.spec` ("finish → Today") uses `signIn` without `newAccount`, so no E2E covers what a real new user sees: onboarding, then the *first-day* Today. That journey is the point of C1.
  - `settle_days` starts at the sign-up date, plus one when that date has no wake. With `created_at` set to yesterday, specs that seed a wake on yesterday now settle yesterday as soon as today's wake-day starts. These are `regressions-m3` F2a, F3 and F2b (all `addWakeEvent(id, yesterday())`). Settling brings streak changes and plot wilt from the missed blocks. Before this change nothing was settled. Their current assertions don't look at those effects, so they should still pass, but the behaviour now depends on the hour the suite runs.
  - I checked the other worries and they are fine: the weekly review needs the account to exist by the review week's Thursday (26 h is never enough), and welcome-back needs 3 away days (26 h gives at most 2).
- **Fix:** add one E2E with `newAccount: true` that goes onboarding → All set → "I'll start" → Today and expects the first-day screen (fold present, no exercise card). Consider setting `created_at` in `regressions-m3`'s `user()` to two days back, so settling is deterministic.

### R-C-12 (S3) In-place edits from the bed card and the timeline sheet don't trigger the reward claim
- **Where:** `TodayScreen.tsx:340–348` (bed card) and `:430–438` (timeline `Sheet`). Both get `actions` (so they show the new editors) but no `onChanged`.
- **What happens:** Sleep has no checklist by default, so the bed card now shows "+ Add a checklist item". Adding one there pays the checklist reward only at the next claim (the next Today load). The "You got 20 coins" notice comes later, on a different visit.
- **Fix:** pass `onChanged={setup.reload}` to both.

### R-C-13 (S3) A first step from Today becomes the default for every day, but the button doesn't say so
- **Where:** `messages/en.json` `today.block.pickFirst10` / `addItem`; `BlockCheckin.tsx`.
- **What happens:** the plan (C2) says the checklist field "saves to the same place Plan's editor does", and Plan's editor saves for **this day** unless she taps "save as my default". The in-place versions always write the default (a choice logged in DECISIONS), and nothing on screen says "every day". Together with R-C-1, a user can't tell that her other days changed.
- **Fix:** add a short line under the editors, such as "Saved for every day · change it in Plan" (EN and TH).

### R-C-14 (S4) `history.replaceState` runs during render
- **Where:** `FarmScreen.tsx:161–166`.
- **What happens:** the replace runs during render. If React discards that render (a concurrent re-render, or StrictMode in dev), the URL changes anyway.
- **Fix:** move the `replaceState` call into an effect that runs when `capsulesOpened` becomes true.

### R-C-15 (S4) The "Everything else today" disclosure has no visible open/closed sign
- **Where:** `TodayScreen.tsx:453`.
- **What happens:** `summary` is `flex`, which removes the default triangle in Chromium and Firefox, and no chevron replaces it. Inside, the cards (`bg-surface`) sit on the same `bg-surface`, so there are no visible card edges.
- **Fix:** add the existing `ChevronIcon`, rotated with `group-open:`, and give the inner area `bg-transparent`.

### R-C-16 (S4) The Down hint says "plan tomorrow in the Night ritual" after it's done
- **Where:** `TodayScreen.tsx:315`.
- **What happens:** the current-block card appears for Down only when `nightDone`, so the hint tells her to do something she has already done.
- **Fix:** skip the hint for `down`, or reword it.

### R-C-17 (S4) The sleep-times reward now shows a ticket picture
- **Where:** `SetupCard.tsx:25` (`RewardArt` checks `tickets` before `seed`).
- **What happens:** the setup list row and the reward notice for sleep times show a ticket. Before, they showed the strawberry, and the label starts with "2 Strawberry seeds". Users who go through "Open your first capsule" also never see the "You got…" notice for the seeds, because onboarding has already claimed them.
- **Fix:** show both pictures for a combined reward, or keep the seed picture first.

### R-C-18 (S4) The client uses a 15-minute wake window instead of the setting
- **Where:** `lib/today/firstDay.ts:16`; `useToday.ts` (`missedFirstWake(createdAt, target)`).
- **What happens:** the server reads `settings.wake_window_min` (0–120). There is no UI to change it, and DECISIONS records the choice, so it is harmless today. If the setting gets a UI later, this needs to read it (Today already loads `settings`).

### R-C-19 (S4) Small wording and a11y points
- The radiogroup's accessible name is "+ Pick a first step", and the "+" is read aloud.
- The section heading says "First 10 minutes" (TH "10 นาทีแรก"), while the new button says "first step" (TH "ก้าวแรก"). It's the same thing with two names.
- The strip's link name ("Your farm: open it") says nothing about the plots. That's fine for now; something like "3 ready to harvest" could be added later.
- Between midnight and 3 h before the wake target there is no wake card, so the "Tomorrow: tap I'm up" line disappears for a 23:00 sign-up after midnight.

## Checked and OK
- **Migration (prod-safe):**
  - `20261120000000_first_capsule.sql` only `create or replace`s `_setup_reward(text)`, with the same signature, `immutable`, `language sql` and `search_path = ''`. No later migration redefines it.
  - Existing ACLs are kept (checked locally: no `authenticated` execute on `_setup_reward`/`_grant_unlock`).
  - The timestamp is after the latest prod migration (`20261116…`) and not ahead of today.
  - Plans that inline the SQL function are invalidated when it is replaced.
- **Payment path:**
  - `_grant_unlock` (latest in M9) pays every key of a reward independently: `tickets` and `seed` both in one transaction, with a single `unlock_granted` event.
  - `insert … on conflict do nothing` + `row_count` makes it pay once, and accounts that already claimed `sleep_times` get nothing more.
  - `claim_setup_rewards` locks `game_state FOR UPDATE`, so claims from two tabs or from onboarding and Today at once are serialised.
- **No extra tickets by any path I could find:** re-onboarding from More, deleting or changing templates, repeated "Open your first capsule" taps, racing claims, toggling a block's first step or checklist off and on. All are keyed on `(user_id, unlock_id)`. Deleting the account and signing up again was already possible with the `first10` ticket, and this adds one more.
- **Reward shape:** `_setup_done` never reads it. The only SQL that reads it is `_grant_unlock`, using `?` tests. `unlock_grants.reward` and the `unlock_granted` payload are only stored (and exported). There are no client readers.
- **TypeScript consumers of `Reward`:** `RewardArt`, `useRewardLabel` (now joins every part), `SetupRewardNotice`, `CollectionBook` (UNLOCKS rewards are all still single-key). `Cutscene` uses `StoryGift` (a separate type). `tsc` is clean, and the SQL mirror test passes for the combined reward.
- **Settings RLS:** the update is own-row only, and there is no trigger on `settings.blocks`. The setup reward from Today is paid by the server from the data (`_setup_done` checks `settings.blocks`).
- **One farm read on Today (C3):** a single `useFarm` in `TodayScreen` feeds both the strip and `LastChanceLine`, the same count as before. On iPad, `LastChanceLine` still gets data (Today's hook plus the side panel's, as before).
- **`useSearchParams` (C4):** it sits in its own `Suspense` inside `FarmScreen`, so `/farm` still prerenders around it under `cacheComponents`. The compact side-panel `FarmScreen` doesn't read the param or open sheets, and on `/farm` the side panel shows the backlog anyway.
- **The `<details>` fold:**
  - Everything inside stays reachable.
  - The exercise `LogSheet` and `HatchReveal` are `position: fixed` with no transformed ancestor, so they cover the screen once the fold is open.
  - `StreakNotice`, `UnlockNotice` and `SetupRewardNotice` are outside it.
  - The fold flips only when the wake-day changes, not during load (Today renders only once `loaded` is set).
- **`missedFirstWake`:** it only bites on the sign-up day (later targets are after `created_at`). After a 23:00 sign-up the Night ritual still auto-offers once onboarding is done (Down's offer is unchanged). The wake tip is hidden together with the button.
- **First-day E2E time math:**
  - `hhmmFromNow` floors to the minute, so with a wake 150 min ago Work (60 + 90 min later) has started.
  - `crossesMidnight(150)` / `(100)` skip the cases where the wake would fall on yesterday's date.
  - The 26 h "day-two" account lands on yesterday's or an earlier wake-day at any hour.
  - The ticket assertions in the today, night-plan and stats specs are now relative and taken after `settle`.
- **Rules:**
  - EN and TH exist for every new key (1283 = 1283).
  - New controls are ≥ 44 px (`min-h-11`).
  - The input is 16 px, so iOS doesn't zoom.
  - Colours are tokens only (`--art-leaf-2`, `bg-surface-2`, `text-accent`): no hex, no black.
  - There is no new animation, so nothing new for reduced motion.
  - Errors use `role="alert"`.
  - The strip link has an `aria-label`, and its sky is `aria-hidden`.

## Required before PASS
1. R-C-1: in-place editors only when the default itself is empty; append, never replace; write tests as above.
2. R-C-2: reserve the strip's space from the first render (no layout shift under "I'm up"), with a bounding-box test.

After those two fixes, a re-review of the changed lines is enough. Recommended in the same pass because they are cheap: R-C-3, R-C-4, R-C-7, R-C-9, R-C-12.
