# Phase C G7 re-review: changed lines only

- **Scope:** the uncommitted fixes on `review-c-local` (`git diff`, 12 files, +231/−44). I re-checked the tree during the review: it grew while I was reading, adding R-C-8, R-C-10, R-C-11 and DECISIONS. This review covers the final state, diff md5 `02a6c525…`.
- **Reviewer:** an independent G7 subagent.
- **Date:** 2026-11-20.
- **What I ran:**
  - `tsc --noEmit`: clean.
  - ESLint on all changed code and spec files: clean.
  - `i18n:check`: 1284 keys, EN = TH.
- **Not run:** E2E, build and servers. The findings below come from reading the code.

## Verdict: FAIL

R-C-1 is only partly fixed, and one S2 is still open. On the default setup, the in-place picker still overwrites the every-day first step after a "None for today" on 5 of the 7 blocks. Everything else is fixed or acceptable. The new tests have two time-of-day bugs (S3).

## Status of R-C-1 … R-C-19

| ID | Sev | Status | Note |
|---|---|---|---|
| R-C-1 | S2 | **partly** | The checklist part is fixed. The first-step part is still open for blocks with a built-in default; see **N-1**. The picker now resets after a save (fixed). |
| R-C-2 | S2 | fixed | The placeholder and the loaded strip have the same height and margin (`h-14 mb-3`), and the strip still collapses on error (N-6). The E2E would catch the old pop-in. |
| R-C-3 | S3 | fixed | `checked` is set on every exit path of the check, and the scene and `checked` are set in one batch. There is no E2E with `story: true` (N-8). |
| R-C-4 | S3 | fixed | The button has a busy state, and the param is cleared once `gacha.state` loads. With 0 tickets the farm opens silently, which is logged in DECISIONS. |
| R-C-5 | S3 | mostly | A cross-device Plan edit is no longer reverted. The residual races are in N-5. |
| R-C-6 | S3 | deferred | Kept as is and logged in DECISIONS. |
| R-C-7 | S3 | fixed ≤ 500 px | Fixed up to about 500 px, but the strip now clips between 503 and 1023 px (N-3). |
| R-C-8 | S3 | fixed | A debounced farm reload runs after a log or wake change. Test: `farm-strip.spec`. |
| R-C-9 | S3 | fixed | |
| R-C-10 | S3 | fixed | The setup hint sits inside the fold on the first day. |
| R-C-11 | S3 | partly | The new-journey E2E exists but is time-of-day dependent (N-2b). |
| R-C-12 | S3 | fixed | The bed card passes `onChanged`. The timeline sheet gets no `blockDefault`, so it no longer shows the editors (N-7). |
| R-C-13 | S3 | fixed | `today.block.everyDay` exists in EN and TH, and the TH wording matches "หน้าวางแผน". |
| R-C-14 | S4 | not fixed | `replaceState` still runs during render (`FarmScreen.tsx:166`). |
| R-C-15 … R-C-19 | S4 | not fixed | Not addressed and not logged. That's acceptable for S4, but list them as deferred in the QA report. |

## New findings

### N-1 (S2): R-C-1 still reproduces for blocks with a built-in first step
- **Where:** `components/today/BlockCheckin.tsx:210`: `blockDefault && !blockDefault.first10`.
- **Why:** in `BlockSetting`, `first10: null` means "the built-in text". That applies to down, sleep, wake, work and gradation (`content/blocks.ts`, `useBlockText.first10`). `DEFAULT_BLOCKS` has `null` for all seven blocks, so `!null` treats "has a built-in default" as "empty".
- **Scenario (default account):**
  1. On the Wake card she uses the swap chooser and picks **None**, which saves the override `first10: ""` for today.
  2. The card shows "+ Pick a first step".
  3. She picks a suggestion. `setBlockDefault` replaces Wake's built-in default **for every day**.
  4. Today's card stays empty, because the `""` override still wins.
  5. After the reload, the picker turns into "Set your first-10 action in Plan", so her pick seems to vanish.
- The same happens when a kind of day carries `first10: ""` and the default is `null`. This is the R-C-1 failure as originally described (scenario 1). The new E2E uses Focus, which has no built-in text, so it misses this case.
- **Fix:** show the picker only when the default resolves to no text: `text.first10(block.key, blockDefault.first10) === null`.
- **Test-first:**
  1. Set Wake's or Work's default `first10: null` and the day override `first10: ""`.
  2. Expect no "+ Pick a first step".
  3. Expect `settings` Wake `first10` to still be `null`.

### N-2 (S3): The new E2Es depend on the time of day
- **a.** `tests/e2e/first-day.spec.ts:136` ("G7 R-C-1") writes the override to `wakeDay()`, which assumes a 10:00 wake. The test sets the wake to 100 min ago. From about 01:40 to 10:00 Bangkok (18:40–03:00 UTC), `wakeDay()` returns **yesterday**, so the override misses today. The card then shows "Open the notes" and the test fails.
  - **Fix:** use `localDate(new Date(), "Asia/Bangkok")` (already imported; `crossesMidnight(100)` already guarantees the same date).
- **b.** "G7 R-C-11" calls `setWakeMinutesAgo(150)` and then picks **Student**. `applyStarter → replaceKinds` upserts the kinds with `target_wake` 07:30 and 09:00, which overwrites the patched wake, so `crossesMidnight(150)` guards nothing. From about 22:00 to 07:30 Bangkok there is no "Current block" region (Down only after the ritual, Sleep shows the bed card, and nothing shows before the wake), so the test fails.
  - **Fix:** skip the starter, or call `setWakeMinutesAgo` after "All set" and before Done.

### N-3 (S3): The strip clips Som and the plots at 503–1023 px (iPad portrait, landscape phones)
- **Where:** `components/today/FarmStrip.tsx:34`.
- **What happens:** the columns are `(W − 32 − 22) / 8` wide, and the art is `aspect-square w-full`, so each plot is as tall as its column is wide. The strip is fixed at 56 px with `overflow-hidden`.
  - Above a 502 px viewport the plots are taller than the strip.
  - At the `max-w-2xl` cap (672 px) they are 77 px tall, so about 21 px of every crop top and Som's head is cut off.
  - This affects iPad portrait (744–834 px, below `lg`) and phones in landscape.
- **Fix:** cap the cell size, e.g. `grid-cols-[repeat(8,minmax(0,3rem))] justify-between`, or add `max-w-12 mx-auto` on each cell.
- **Test:** at 820 × 1180, every `[data-plot]` box should lie inside the link's box. The same check at 360 px would also cover R-C-7.

### N-4 (S4): A checklist "append" doesn't use the fresh read
- **Where:** `BlockCheckin.tsx:251`.
- **What happens:** the append uses the `blockDefault` prop, which is always `[]` here, so `setBlockDefault` writes `checklist: [new]` over the fresh `settings`.
  - If another device added default items to this block since Today loaded, they are replaced.
  - A second "Add" before the reload lands also replaces the first item, because the field stays visible until then.
- **Fix:** do the append inside `setBlockDefault` from `current`'s block, e.g. an `appendItem` action, or a patch function `(s) => ({ ...s, checklist: [...s.checklist, item] })`.

### N-5 (S4): `setBlockDefault` is still a read-then-write of the whole array
- **Where:** `lib/today/useToday.ts:671–672`.
- **What happens:** a first-step pick and a checklist add made within one round trip can still undo each other. The window is now much smaller. The longer-term fix suggested in R-C-5 (patch one block on the server) still applies.

### N-6 (S4): The strip leaves the layout when the farm fails
- **Where:** `FarmStrip.tsx:20`.
- **What happens:** after the quiet retry fails, the placeholder disappears and the content moves 68 px **up**. Only the error path is affected.
- **Fix:** keep the empty band on error, or render a static strip that links to `/farm`.

### N-7 (S4): The timeline sheet silently lost the in-place editors
- **Where:** `TodayScreen.tsx:~445`.
- **What happens:** the sheet still gets `actions` but no `blockDefault`, so it now shows "Set your first-10 action in Plan". That's safe, but it isn't mentioned in DECISIONS.
- **Fix:** either pass `blockDefault` and `onChanged`, or log the narrower scope.

### N-8 (S4): Smaller test-strength and a11y notes
- The R-C-2 test could pass vacuously if the farm loads before `I'm up` is first visible (slow dev compile). Assert the strip link has count 0 before reading `before`.
- R-C-3 has no E2E with `story: true` ("Open your first capsule" → scene first → then the machine).
- The `farm-strip.spec` R-C-8 test has no `crossesMidnight(10)` skip.
- The "Sets it for every day" line isn't linked to the controls (`aria-describedby`).

## Checked and OK
- **React correctness:**
  - Hooks order is unchanged.
  - The new render-phase `setState` in `FarmView` is guarded by `capsulesOpened` (set once).
  - The R-C-8 effects:
    - The ref-sync effect runs before the debounce effect in the same commit.
    - The debounce is cleared on unmount.
    - There is no reload loop, because a farm reload doesn't change `logs`.
- **useStory:**
  - `checked` covers the no-session, RPC-error, no-beat, claim-failed and pending-beat paths.
  - The `busy` and `other` paths report `checked` at once, and no beat can play while busy.
- **Settings load failure:**
  - `blockSettings` falls back to `[]`, so `blockDefault` is undefined and the editors stay hidden.
  - A failed fresh read throws, and the picker or field shows `saveError`.
- **i18n:** `everyDay` is in EN and TH, `common.loading` exists, and the TH hint now says รูทีนก่อนนอน.
- **Touch targets, art and accessibility:**
  - No new interactive element is under 44 px.
  - The placeholder uses the `bg-surface` token, is `aria-hidden` and has no hex colours.
  - No new animation.

## Round 2: N-1 … N-4 (2026-11-20)

**Verdict: PASS.** No S1 or S2 is open. This review is by code reading. The full Chrome E2E was still running when I finished, so the result depends on that run being green.

- **What I ran:**
  - `tsc --noEmit`: clean.
  - ESLint on the 5 changed code and spec files: clean.
  - `i18n:check`: 1284 keys, EN = TH.
  - `setBlockDefault` has no other callers, so the signature change is covered by `tsc`.

| ID | Status | Verification |
|---|---|---|
| N-1 (S2) | **fixed** | `BlockCheckin.tsx` now checks `text.first10(block.key, blockDefault.first10) === null`. A built-in `null` on down, sleep, wake, work or gradation never shows the picker. Focus and Free with `null` (the C2 test) and any block with `""` still do. The new E2E "G7 N-1" covers it: Work, `null` default, `""` override; it expects no picker and the default still `null`. It would fail on the old condition. |
| N-2 (S3) | **fixed** | The R-C-1 test uses `localDate(new Date(), "Asia/Bangkok")`. `crossesMidnight(100)` guarantees that is the wake-day. R-C-11 now calls `setWakeMinutesAgo(150)` after "All set" (after the starter has written its kinds) and before Done, so its midnight guard holds. |
| N-3 (S3) | **fixed** | `grid-cols-[repeat(8,minmax(0,3rem))] justify-between` caps each cell at 48 px, so a plot plus the inline-SVG line gap is about 53 px, inside the 56 px strip. Cells still shrink at 320 px. The E2E checks every `[data-plot]` box at 360 and 672 px. 672 px is the `max-w-2xl` cap, so it also covers 672–1023 px. |
| N-4 (S4) | **fixed** | `setBlockDefault({ addItem })` appends to the checklist it has just re-read (`[...(s.checklist ?? []), item]`). A second Add before the reload, or items added on another device, are kept. `first10` is patched only when given. |
| N-5 … N-7 (S4) | accepted | Logged in DECISIONS (last entry). |
| N-8, R-C-14 … R-C-19 (S4) | open | Not in DECISIONS. They don't block, but list them as deferred in `docs/qa/REVIEW-C-report.md`. |

**Residual notes (S4, no action needed for the gate):**
- A kind of day with its own `first10: ""` on Focus or Free, where the default is `null`, still offers the picker. That write is safe, because the default really was empty. Today's card stays empty, though, because the template value wins, so the pick seems to have no effect until another day.
- The N-1 E2E expects the early-days hint "Classes or work". That only shows for the first 3 wake-days. It's fine with the 26 h test accounts, but the test will break if the default account age changes.
