# G7 independent review: yard in two rows, backlog beside the farm, estimates Try again, test safety (branch phase-testsafety-local)

Scope: `git diff origin/main...HEAD` (one commit, 7402c12). Reviewer: independent QA, 2026-11-24. Tested against the production build at http://localhost:3100 on the local Supabase, in Chromium (the `chrome-desktop` project with set viewports). I did not run WebKit.

**Verdict: FAIL.** There are 3 × S2, all in the new iPad/Mac side panel. There are also 5 × S3 and 7 × S4. The yard, the estimates card and the two test-safety changes pass on their own.

## Conformance

| # | Claim | Result | Evidence |
|---|---|---|---|
| 1 | Yard spots are two ordered rows of 4. "Move to…" is a 4 × 2 map with item pictures | **PASS** (polish: S3-3) | `content/yard.ts:9-18`. `tests/unit/yard.test.ts` passes. Measured at 390 px: back-row items at y = 5, front-row items at y = 77, columns at x = 23/112/202/291 (each 44 × 44). In the picker the current spot is ringed with "Here now", taken spots show the item's art and empty spots are dashed (`Yard.tsx:181-201`). Screenshots: `picker-390-en-light.png`, `picker-320-th-dark.png`, `mac-picker.png`. |
| 2 | On iPad/Mac the side panel beside Farm is the real backlog | **FAIL** (S2-1, S2-2, S2-3, S3-1, S3-2) | `SidePanel.tsx:10`, `SideBacklog.tsx`. What works: capture, tick (+10 coins on the server), the "How long did it take?" prompt (`actual_min` = 15 saved), and the events `backlog_item_added`, `coins_granted` and `backlog_item_done`. There is one `<h2>Backlog</h2>` inside `<aside>`, no duplicate ids, and axe plus the touch-target check are clean at 1024, 1366 and 1440. What breaks: opening a task, any task with a date, and the coin balance next to the panel. |
| 3 | The Stats estimates card has Try again | **PASS** | `EstimateCard.tsx:42-50`. New E2E passes. My probes: the button is 101 × 44 px, and a retry that fails again keeps the error and the button (TH dark: `estimates-error-th-dark.png`). |
| 4 | Playwright global setup stops on a DB that is missing migrations | **PASS** (robustness: S3-5, S4-6) | The current DB passes. A copy of the repo layout with an extra `20991231000000_new.sql` throws "missing 1 migration(s): 20991231000000 … Run `npx supabase migration up`". With a wrong `project_id`, the container isn't found, so it warns and continues. CI starts a fresh `supabase start`, so all migrations are applied and the container name `supabase_db_twentyfour-seven` matches: no false block in CI. |
| 5 | The visual spec fails a shot that shows a visible `role="alert"` | **PASS** (weak: S3-4) | No false positives: at 390 and 1440, in EN and TH, every screen in `SCREENS` (today, plan, farm, stats, more) has 0 visible alerts at 400 ms and again at 3.4 s. Next's route announcer is correctly excluded: it is 1 × 1 px and Playwright counts that as visible. |

## Findings

### S2-1: A task with a date disappears from the side panel, and the panel then says "Nothing here yet"
- **Repro (1440 × 900, /farm):** type `Report 30m tomorrow` into the side panel and press Enter.
  - The input clears and the panel shows the empty basket with "Nothing here yet. Type anything that's on your mind."
  - The DB row exists: `{title: "Report", status: "scheduled", scheduled_date: "2026-10-29"}`.
  - Evidence: `side-date-after.png`.
- **Cause:** `BacklogList` hides every task scheduled for today or later. Those tasks "live on the strip + day card" (`BacklogList.tsx:330-334`), and the side panel has neither.
- **Effect:** the panel looks like it lost the task, and today's planned tasks can't be ticked from it. The capture preview even tells the user it will save to Thu. An `@14:00-15:00` appointment capture vanishes the same way.
- **Fix:** in side mode, show the scheduled tasks for today and later, with the date pill (`showDay`), at least today and this week. Or, after saving a dated task, show a confirmation ("Saved to Thu 29 Oct · Open Plan"). Add an E2E test for a dated capture in the panel.

### S2-2: "Edit {title}" in the side panel goes to Plan but doesn't open that task
- **Repro:** at 1440, capture "Email advisor" in the panel, then tap its title. You land on `/plan` with no dialog open (`dialogOpenOnPlan: 0`; `side-open-mac-en.png`). You have to find the task again and tap it a second time.
- **Cause:** `SideBacklog.tsx:47` is `onOpen={() => router.push("/plan")}`, which drops the id. `PlanScreen` can't open an item from the URL.
- **Effect:** the claim says "opening a task goes to Plan for the full sheet", and that sheet is also the only route to "Move to…" (see S3-1).
- **Fix:** `router.push(\`/plan?item=${id}\`)`, and have `PlanScreen` read `item` once to call `setEditingItem`, then clear the param. Write the test first.

### S2-3: Coins earned in the side panel don't show in the farm's Shop right next to it
- **Repro:** at 1440 the account has 25 coins. Capture "Task A" in the panel and tick it.
  - The panel shows the "+10" pop, and the DB has `coins = 35`.
  - After 5 s the Shop header in the main column still says **25** (`shopCoins1: ["25"]`).
  - `side-tick-mac-en.png` shows the same with "+10" next to "Shop 0".
- **Cause:** `useFarm` reloads only on `plots` changes. The Shop's buy buttons disable on `s.coins < price` (`Shop.tsx:441-615`), so a buy the user can now afford stays disabled until a reload.
- **Note:** this interaction is new. Before this commit the only side panel was the compact farm beside Plan, and it has no Shop.
- **Fix:** after `backlog.complete` returns coins, ask the farm to reload. This could go through a shared store event or a realtime subscription to `game_state`. Add an E2E test: tick in the panel, then the Shop shows the new balance.

### S3-1: The drag grip in the side panel does nothing, and no "Move to…" is reachable
- **Problem:** each row still shows the `Drag {title}` grip (`aria-roledescription="draggable"`, `aria-describedby=""`). There is no `DndContext` and no drop target in the panel, so Space, arrow keys, click and drag all do nothing (the row stays `inbox`).
- **Rule breach:** the rule is that every drag has a "Move to…". That fallback lives in the item sheet, which the panel can't open (S2-2). So the panel offers a control that is dead, with no way out.
- **Fix:** add a `draggable={false}` prop to `TaskRow`/`BacklogList` and hide the grip in the panel. Or give the panel a "Move to…" (schedule) action.

### S3-2: A side-panel load error has no Try again and isn't announced as an error
- **Repro:** fail `templates`, `profiles` and `day_plans`. The panel shows "Something went wrong. Your data is safe — please try again." in a `role="status"` paragraph with no button (`SideBacklog.tsx:27-30`).
- **Why it matters:** this commit's own rule (estimates card, M14 states audit) is that every failed load offers Try again.
- **What does work:** with the backlog request failing, `BacklogList` does show its own alert with Try again, and Try again recovers.
- **Fix:** use `role="alert"` plus `<Button onClick={plan.reload}>{tc("retry")}</Button>` when `plan.status === "error"`.

### S3-3: Butterflies and birds sit on Som (and on items at 320 px)
- **Observed:** with 6 or more items placed, the visitors' fixed percentage positions (`Yard.tsx:127,137`) land on Som in 5 of his 8 spots:
  - a pink butterfly on his head at spots 1 and 4;
  - the yellow butterfly over him at spots 2 and 3;
  - a bird in his lap at spot 7;
  - touching him at spots 5 and 6.
- **At 320 px**, the birds (x = 72 and 144) also overlap the mailbox in spot 6 and the café table in spot 7.
- **Not a problem:** Som is never clipped at the band's edges. He flips to the inner side for columns 3–4 (`x < 0.5`).
- **Evidence:** `som-sheet-390.png`, `som-sheet-320.png`, `yard-night.png` (where the butterfly hides Som's face). Som is the main "reason to buy", and the art rule wants objects to stay readable.
- **Fix:** put visitors in the gaps between columns (x = 25/50/75 %), vertically between the rows, and skip the gap next to Som's spot that day. Add a unit or E2E check that a visitor's box doesn't intersect Som's or any item's box at 320 and 390.

### S3-4: The visual error guard checks once, early, and only on two of the six shot tests
- **Problem:** `expectNoErrorState` runs once, 400 ms after `goto`. `toHaveCount(0)` passes at once when nothing is there yet, and errors often arrive later:
  - `useBacklog` makes one quiet retry after 800 ms before it shows its error;
  - slow requests arrive later still.
- **Demo:** an estimates request that fails after 1.5 s has 0 visible alerts at 400 ms and 1 at 2.9 s. `toHaveScreenshot` can still record that baseline, which is the incident this guard exists for (#35).
- **Also:** the night-ritual, plan-week, capsule and Seed-dex shots aren't guarded at all.
- **Fix:**
  - wait until no `[role=status]` loading text is left (or for `networkidle`) before checking;
  - check again right after `toHaveScreenshot`;
  - and/or collect `page.on("response")` 4xx/5xx from `/rest/v1/` and `/rpc/` and fail the shot.

  Apply it to every shot.

### S3-5: The preflight has no escape hatch and gives a risky fix for migrations applied by hand
- **Problem:** a migration applied with `psql -f` (or Studio) isn't in `supabase_migrations.schema_migrations`. Every Playwright run then stops, and the message says to run `npx supabase migration up`. That command would run the non-idempotent SQL again and probably fail with "already exists".
- **There is no override:** no `SKIP_DB_PREFLIGHT`, for example.
- **Fix:**
  - add an env override;
  - mention `npx supabase migration repair --status applied <version> --local` in the message;
  - consider listing only the versions, so the developer can judge.

### S4 (nits)
1. **The picker map has no item names, and its accessible names point to numbers that are no longer shown.**
   - Items are identified only by 36 px art, so the garden lantern, farm sign and wind chime are small and similar.
   - The accessible names are "Move to spot 6 (swaps with …)", but spot numbers no longer appear anywhere on screen.
   - The highlighted cell shows "Here now", but its accessible name is "Move to spot 1", which fails WCAG 2.5.3 Label in Name.
   - **Fix:** a short name under the art, or aria text like "back row, 2nd from left".
2. **The yard keeps the old position briefly after a move.** The sheet closes on RPC success before the yard reloads: right after it closes, the item is still drawn at its old spot (`count = 1`, about 50 ms locally, longer on mobile data). A tap in that window opens a sheet built from the stale `open.item`, with "Here now" on the old, now empty, cell. The pattern was already there before this commit, but the new highlight makes it visible. **Fix:** update the yard optimistically, or look up the open item by id from the current `items`.
3. **The estimates Try again shows no busy state.** If it fails again, nothing visibly changes (2 requests, same text). Disable the button while loading.
4. **The side-panel E2E test is thin.** It lives in `tests/e2e/stats.spec.ts` and covers capture only. Tick plus the estimate prompt, open, dated capture and the error state are untested. Move it to a backlog or shell spec.
5. **The visual baselines aren't updated or listed as intended diffs** (QA_QC G3).
   - On every project, the yard moved and is 16 px taller. Fresh accounts get the mailbox from the unlock ladder, so the farm, and the compact farm in the iPad/Mac side panel, show the yard.
   - The iPad/Mac farm shots now show the backlog.
   - (The committed baselines are already very old, e.g. "Stats are coming soon".)

   Record new baselines and state the intended diffs in the report.
6. **The preflight's paths depend on the working directory.** `readFileSync("supabase/config.toml")` sits outside the `try`, so running Playwright from another directory crashes global setup with ENOENT (reproduced). It also checks the local Docker DB even when `NEXT_PUBLIC_SUPABASE_URL` isn't local. **Fix:** resolve paths from the helper's own location, and skip unless the URL is 127.0.0.1 or localhost.
7. **Already on main, not from this commit:**
   - the Thai plot labels are truncated in the iPad-portrait main column ("เปลี่ยน…", "พัก ก่อ…" in `side-ipad-p-th.png`);
   - butterflies still fly in the night yard.

## Visual QC: the yard and the picker (rubric)

| # | Score | Reason |
|---|---|---|
| R1 Style | 4 | The art is unchanged and flat with no outlines. The dashed picker and empty-spot borders are UI chrome made from tokens. |
| R2 Consistency | 4 | Both rows read as one set, and the picker uses the same art as the yard. |
| R3 Readability | 4 | Items are clear at 44 px in the yard. At 36 px in the picker, the lantern, sign and wind chime are close (S4-1). |
| R4 Layout | **3** | The rows are aligned with the plot columns at 390 px, there's no clipping and no horizontal scroll at 320 or 390. But visitors overlap Som, and at 320 px they overlap items (S3-3). |
| R5 Typography | 4 | "Here now" / "อยู่ตรงนี้" at 11 px fits at 320 px. Thai renders cleanly. |
| R6 Color & contrast | 4 | Light, dark and night all work. The current spot's `ring-primary` reads clearly in dark mode. |
| R7 Motion | 4 | No new motion. The sheet closes at once, and there's no runtime layout shift. |
| R8 Delight | 4 | Som sitting by an item plus the visitors make a fuller yard feel alive. |
| R9 Not AI-looking | 4 | Hand-built SVGs with a calm, even grid. |

**The night yard** (`yard-night.png`) uses the night band and veil correctly, and the items stay readable.

## UX budgets
- **Taps:**
  - Move an item: 2 (item → spot). Measured at about 1.7–1.9 s including the round trip and the sheet closing.
  - Put away: 2.
  - Place from storage: 2 (a stored item → a spot, or an empty spot → an item).
  - Tick in the side panel: 1, plus 1 for the estimate answer.
- **Touch targets:**
  - Yard items, empty spots and storage tiles: 44 × 44.
  - Picker cells: 84 × 64 at 390 px and 66 × 64 at 320 px.
  - Estimates Try again: 101 × 44.
  - `expectTouchTargets` passes on /farm at 1024, 1366 and 1440 with the panel.
- **Layout shift:** the yard band is 16 px taller (h-28 → h-32), and it is laid out on first paint. The estimates card grows 16 px after a successful retry (a change the user asked for).

## Checks run
- `npm run qc:static`: typecheck, ESLint, Prettier, i18n (1332 keys, EN = TH) and art lint (24 files, 74 tokens) all clean. No stale `placeholder`/`comingSoon`/`farm.yard.spot` references.
- `npx vitest run` with the local Supabase env: 117 files, 768/768 passed.
- **Playwright `chrome-desktop`:** farm, yard, backlog, shell (including the G4 a11y/touch/scroll sweep), states, stats (both new tests), regressions-m0 (F11 "iPad Farm tab doesn't show the farm twice"), farm-strip and shop. 45 passed, 1 skipped.
- **Temporary probe specs** (deleted afterwards; the working tree is clean apart from this file):
  - **Yard matrix:** 390 × 844 and 320 × 640, EN/TH, light/dark, with 0/0+2 stored/1/4/5+1/8/8+2 items. I captured the geometry (items, Som, visitors), checked for horizontal scroll and ran axe in the picker.
  - **Yard actions:** swap, put away, place from storage, a sheet opened from storage, and Som pinned to each of the 8 spots by choosing the date.
  - **Night yard:** at 02:30.
  - **Mac:** the yard and picker in TH.
  - **iPad portrait (1024), iPad landscape (1366) and Mac (1440), side panel:**
    - headings and landmarks: one h1 in `main` and h2 "Backlog" in `aside`;
    - capture, tick (coins in the DB), estimate prompt and answer;
    - open (where it lands);
    - the grip;
    - dated capture;
    - loading, backlog error plus Try again, and plan error.
  - **Error guard:** every screen in the visual spec at 390 and 1440 in EN and TH (no false positives), plus a demo of a late error.
  - **Estimates:** an error that fails again, and a retry that succeeds.
  - **Preflight:** a fake missing migration (blocks), a wrong project id (warns and continues), and a different working directory (ENOENT).
- **Screenshots** are in `/tmp/claude-0/-home-user-twentyfour-seven/70c331e7-c8a5-54e2-a6b6-8031bbfe6cac/scratchpad/review-ts/`:
  - `yard-*.png`, `picker-*.png`, `place-*.png`, `som-sheet-{320,390}.png`, `yard-night.png`;
  - `side-*.png`, `mac-*.png`;
  - `estimates-error-*.png`.
