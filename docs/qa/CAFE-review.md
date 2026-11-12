# G7 independent review: Snow Strawberry beats + year_review, block clock, Som's café

- **Scope:** `git diff 65cf580..31f7193` (6 commits: 97b1975, d1b8407, 387f256, efc25db, 08c18b9, 31f7193). HEAD moved to 91f022f during the review, and the worktree has uncommitted edits (`cafe.sql`, a new `20261114020000_story_chapters.sql`, …). Those later changes are **not** reviewed here. Line numbers refer to 31f7193.
- **Reviewer:** fresh G7 subagent with no implementation context.
- **Date:** 2026-11-12.

## What I ran
| Check | Result |
|---|---|
| `tsc --noEmit` | pass |
| `eslint` + `prettier --check` on changed files | pass |
| `npm run i18n:check` | pass (990 keys EN/TH) |
| `npm run art:lint` | **FAIL**: `components/art/farm/Cup.tsx:51 stroke width 3 > 1.5` |
| `vitest run tests/unit` | 341/341 pass |
| `vitest run tests/integration/cafe.test.ts snow-story.test.ts rls.test.ts` | 86/86 pass |
| Ad-hoc probe: 6 parallel `order_drink` calls across the 10th stamp, ×3 trials | decor `cafe_table` granted exactly once (the `game_state` row lock serializes correctly) |
| Ad-hoc probe: 3 parallel `answer_coffee` calls | 1 ok, 2 "already answered" (PK + `on conflict do nothing` is race-safe) |
| Ad-hoc probe: claim `snow_use` with the clock at 2027-01-05 after a Jan-4 sale, then `year_review()` | beat granted as `snow_use:2026`, but review = `{year: 2027, harvests: 0, …}` (see R-C2) |
| Function/table privileges in local DB | new RPCs are `security definer`, `search_path=''`, not executable by anon; helpers not executable by authenticated; `cafe_orders`/`coffee_answers` are SELECT-only for authenticated; profiles adds column UPDATE on `cafe_game_only` only |
| E2E (`cafe.spec.ts`, `seasonal.spec.ts`) | not run (needs a dev server); read only |

## Findings
| ID | Sev | Where | Failure scenario | Suggested fix |
|---|---|---|---|---|
| R-C1 | **S1** | `supabase/migrations/20261114010000_cafe.sql:121-130` | **The café is an unlimited coin faucet that costs no effort.** After the first card, every 10 free taps give +20 coins, with no cap and no cost. The coins also skip the `coin_grants` ledger and the `coins_granted` event that every other coin source uses. Backlog coins, for example, are capped at 150/day in `backlog_coin_rules.sql`. Tapping (or a script calling the RPC) mints coins: 75 taps = 150 coins = a gacha ticket via `exchange_ticket`, and 200 taps = a Farmhouse upgrade. SPEC §8 ties coins to real-life effort, and STORY.md only promises "a café decor item" at 10 stamps; the coins were invented (DECISIONS 2026-11-13). | Make later cards non-economic (a cosmetic, a Som pose, a card counter), or route them through `coin_grants` (reason `cafe_card`) with a server cap, e.g. at most one coin card per week. Add an integration test showing the cap. Log the choice in DECISIONS or ask Minnie. |
| R-C2 | **S2** | `supabase/migrations/20261114000000_snow_story.sql:77` (`year_review`) | **The "year-end cake" can show the wrong year.** It reviews the *calendar* year of the day the beat plays. `snow_use` is keyed by season-year, and Snow Strawberries regrow all year (DECISIONS R7), so the beat fires after the first sale at any time from January to November. It also fires in January when a late-December sale's beat waits a day (one beat per wake-day, busy/Down Time). Reproduced: sale on 2027-01-04, beat claimed as `snow_use:2026`, and the panel says "Your 2027 · 0 harvests" although December 2026 had 2. | Use the season-year: `y := public._season_year('snow_strawberry', public._season_day(uid))`. Add an integration case with the clock at 2027-01-05 that expects `year: 2026`. |
| R-C3 | **S2** | `components/art/farm/Cup.tsx:47-53` | The hot-mug handle uses `strokeWidth={3}`. Art lint fails, so G1 (`qc:static`) and G3 ("art lint 0 violations") fail. | Draw the handle as a filled shape (an outer and inner path in `--art-stone-dark`/`--art-cream`), or keep the stroke ≤ 1.5. Re-run `npm run art:lint`. |
| R-C4 | **S2** | `cafe.sql:134-135, 158-160`; `messages/*.json` `cafe.askTitle` | **Non-coffee orders can record a real coffee.** The question follows *any* order, including water, cocoa and jasmine tea. After ordering water, "Did you have one in real life too?" → **Yes** stores a coffee day with a slot, because `coffee_answers` has no drink. The sleep insight then counts water as afternoon/evening coffee. STORY.md says "Real coffee comes only from these explicit answers", and a "yes" to water is not one. | Either ask only after caffeinated drinks (americano, latte, thai_iced_coffee, thai_tea, matcha), or store the ordered drink on `coffee_answers` and let the insight count only caffeinated "yes" answers. Since the spec is ambiguous here, log it in DECISIONS (or ask Minnie). Add a test. |
| R-C5 | **S2** | `cafe.sql:25-34` (one `slot` per day); STORY.md "a second real cup can be added from the cup's sheet" | **A second real cup can't be recorded.** A user who says **Yes** at 09:00 (morning) and then really drinks coffee at 16:00 has no way to record it. The day is stored as morning-only, so the insight puts it on the "no afternoon/evening coffee" side, which corrupts the comparison group. The spec's remedy, the cup's sheet, isn't built, and it isn't listed as deferred in DECISIONS/PROGRESS. | Build the "add another real cup" action (one more RPC, slots as a set or flags), or log it as deferred **and** make the insight exclude "yes-morning" days from the "without" side until it exists. |
| R-C6 | S3 | `components/farm/CafeSheet.tsx:19-42` | **Leaving the question without closing loses the bedtime ask.** Closing the sheet counts as "later", but leaving by any other route records nothing: the tab bar, a route change, backgrounding or killing the PWA. The day is then unanswered, so the bedtime question never comes. STORY.md says "Closing the popup counts as ทีหลัง". | Record "later" on unmount while `asking` (a `useEffect` cleanup with a ref), or have the server count an order with `ask=true` and no answer as "later" at bedtime (`cafe_status`: answer null + an order today → ask at night). |
| R-C7 | S3 | `CafeSheet.tsx:32-36, 91-100` | **A failed answer shows two contradicting messages.** `reply()` sets `answered` before the RPC returns. On failure, "Noted. Enjoy!" and "Couldn't reach the café" both show, and the question is gone, so the user can't retry. If another tab answered first, the copy is also wrong ("couldn't reach"). | Clear `answered` and restore `asking` on error (an optimistic rollback, CJ-16). Treat "already answered" as success plus a reload. |
| R-C8 | S3 | `components/cafe/CoffeeNightAsk.tsx:177-179` | The bedtime answer shows "Thanks, noted." before the RPC result and never rolls back, so a network failure is silent and the answer is lost (CJ-16). | Await first, or roll back `done` and show an error on `false`. |
| R-C9 | S3 | `lib/cafe/useCafe.ts:136-145` | A coin card (+20) never calls `notifyWalletChange()`. The Shop/market coin count (`useMarket` listens for it, G7 ECON E2/E3) stays stale until something else fires it. | Call `notifyWalletChange()` when `r.reward` is set. |
| R-C10 | S3 | `lib/today/blockClock.ts`, `components/farm/FarmScreen.tsx:64`, `components/providers/QuietClock.tsx` | **The R6/R8 fix misses its main case: the next morning.** The saved blocks only cover the last day Today rendered, ending at the sleep block's end, i.e. the next target wake. If the app opens on the Farm the next morning, during the wake window, before Today renders, `blockAt` returns null and Som's beat can play. Class/Work the next day is likewise not auto-quiet until Today is opened. Before "I'm up" is pressed, Today renders the previous wake-day, so this persists until the press. Documented as "nothing is guessed", but it is exactly the scenario R6 named. | Save tomorrow's planned blocks when the Night ritual plans tomorrow, or infer a `wake` window of the wake block's duration after the saved `sleep` block's end. Add a unit test. |
| R-C11 | S3 | `components/story/Cutscene.tsx:196-209` (`YearReview`) | No error state. If `year_review` fails (offline, or before the migration on prod), the panel says "Counting your year…" forever. QA §5 requires loading/empty/error states. | Add an error line (i18n EN/TH) or hide the section on error. |
| R-C12 | S3 | `snow_story.sql:84`; `messages/en.json:1155` | `best_streak` is all-time, but it sits under "Your {year}", so it reads as this year's. | Compute the best streak within the year from `day_results`, or relabel it "Best streak ever". |
| R-C13 | S3 | `cafe.sql:116, 157` (`_wake_day`) | **A pre-wake morning coffee lands on the previous wake-day.** Ordering before pressing "I'm up" and before the target (e.g. 06:30 with a 07:00 target) uses the previous wake-day. If that day was already answered, the real morning coffee isn't asked about. If it wasn't, "Yes" writes a `morning` slot onto *yesterday's* row. | For the ask/answer only, treat an order after local midnight and before the target as the new day, or show a "pressed I'm up?" hint. At minimum, log it in DECISIONS with a test that pins the behavior. |
| R-C14 | S3 | Story/café scope vs STORY.md | The café's opening scene at Farmhouse 2 and the barista outfit aren't built, and neither is listed as deferred in DECISIONS/PROGRESS at 31f7193. CLAUDE.md requires deferred items to be listed. | List them as deferred (or build them; the worktree's uncommitted `story_chapters` migration may be this). |
| R-C15 | S3 | `supabase/migrations/20261114*` | **Future-dated migration names.** The migrations are stamped 2026-11-14 while today is 11-12/13. Any migration generated today by `supabase migration new` sorts *before* them, and `supabase db push` then refuses ("insert before the last migration on remote") unless run with `--include-all`. Related: if `20261114010000_cafe.sql` has already been pushed to prod, editing it in place (as the uncommitted worktree diff does) never reaches prod. | Keep the hand-picked timestamps strictly increasing and note the convention in DECISIONS. Never edit an applied migration: add a new one. |
| R-C16 | S3 | `tests/` | **Missing tests.** No test covers: (a) concurrent orders across the 10th stamp (verified here by probe, but not in the suite); (b) closing the sheet while asking → `later` (E2E); (c) `play` → `answer_coffee_night` refused (only `yes` is tested); (d) `year_review` outside December (R-C2); (e) a coin-card cap (R-C1); (f) the block clock's next-morning case (R-C10). | Add them, test-first for the fixes. |
| R-C17 | S4 | `cafe.sql:140-167` | `answer_coffee` works with no order that day and when game-only is on (the probe confirmed "yes" with zero orders). The client never does this, but the server rule is looser than the doc. | Require a `cafe_orders` row for the wake-day and `not cafe_game_only`. |
| R-C18 | S4 | `cafe.sql:93-137` | No rate limit on `order_drink`. Each call writes 1–2 `events` rows plus an order row, so a script can bloat the tables. | Add a light throttle (e.g. ≤ 1 order/2 s, or N per wake-day) once R-C1 is settled. |
| R-C19 | S4 | `messages/en.json:1167` | "Som made you a **Americano**." The article is wrong for vowels. "a Water" also reads oddly. | Change it to "Som made your {drink}. Stamp!" or "Here's your {drink}". |
| R-C20 | S4 | `CafeSheet.tsx:76-90, 108` | When the question appears, the focused menu button becomes `disabled`, so focus falls to `<body>` (VoiceOver/keyboard), and the question isn't announced. | Move focus to the question heading (`tabIndex=-1`, then `focus()`), or give the section `role="group"` plus a live announcement. |
| R-C21 | S4 | `lib/today/blockClock.ts:34-42` | The `247-block-clock` localStorage entry isn't per user and isn't cleared on sign-out. A second account on the same device uses the first account's blocks for quiet/busy until it opens Today. | Store `uid` with the blocks and ignore a mismatch, or clear on sign-out. |
| R-C22 | S4 | `components/settings/CafeCard.tsx` | The "game only" card shows before the café exists (Farmhouse < 2). It writes no `events` row, and a failed save is silent. | Hide it until the café opens, or add a one-line hint. Optionally log a `pref_changed` event. |
| R-C23 | S4 | `lib/game/cafe.ts:76-79` | `slotOf` uses the device timezone, while the SQL `_coffee_slot` uses the profile timezone. It is unused in the UI today, but it is a mirror that can drift. | Take a `tz` parameter (as the other day helpers do), or drop it. |

## Checked and OK
- **Security:**
  - Clients can't insert into `cafe_orders`/`coffee_answers`/`decor`; the probes got RLS/permission denied.
  - Anon can't call any new RPC.
  - The events deny-list keeps every earlier type and adds `cafe_order`, `cafe_card` and `coffee_answered`.
  - The new tables are in `EXPORT_TABLES`, and `rls.test.ts` covers A/B isolation and anon.
- **Races:** the first-card decor is granted once under parallel orders (the `game_state` `for update` lock comes before the insert and count). `answer_coffee` and `answer_coffee_night` are race-safe (PK and the `night_at is null` guard).
- **Ask logic vs STORY.md:**
  - Asks at most once per wake-day, decided on the server.
  - "Later" gives exactly one bedtime question; "yes" and "play" give none.
  - Game-only never asks, after an order or at bedtime.
  - `coffeeDay` returns null for `play`/unanswered/`later`-without-night, so those days are never counted as "no coffee".
- **Snow beats:** they mirror the Lotus rules (Dec 1 seed, Dec 15 market, use after a sale), with server/client parity tested.
- **Block clock:** absolute ISO times, so a block over midnight (sleep) works. Stale days and garbage return null.
- **i18n:** EN and TH are complete for the cafe and story keys. No hardcoded strings in the new components.
- **Touch targets:** the new buttons are ≥ 44 px (`min-h-11`, `Button`).
- **Art:** apart from R-C3, the art (MistHills, WinterLights, YearCake, CafeTable, iced cups) uses tokens only, with no black and no outlines.

## Verdict
**FAIL.** Open: 1 × S1 (R-C1), 4 × S2 (R-C2, R-C3, R-C4, R-C5), 11 × S3, 7 × S4. After the S1/S2 fixes (test-first), re-run G1 (art lint) and this review.


## Fixes (2026-11-13, after this review; commit after 4c850ac)
| ID | Status |
|---|---|
| R-C1 (S1) | Fixed: later cards are `{card: n}` only, no coins or tickets; integration test checks coins/tickets unchanged after 3 cards. |
| R-C2 (S2) | Fixed: `year_review` uses `_season_year('snow_strawberry', …)`; integration test with the clock at 2027-01-05 → 2026. |
| R-C3 (S2) | Fixed: the mug handle is a filled C shape; `art:lint` OK. |
| R-C4 (S2) | Fixed: asked only after coffee/tea (`_cafe_caffeine`, parity-tested); `coffee_answers.drink` stores the drink; `answer_coffee` needs a coffee/tea order today. |
| R-C5 (S2) | Fixed: `add_real_cup()` on a "yes" day keeps the latest slot; "I had another real one" in the café sheet; tested. |
| R-C6 | Fixed: an unanswered question (any exit) gets the one bedtime question (`ordered` in `cafe_status`). |
| R-C7 / R-C8 | Fixed: "Noted"/"Thanks" only after the server saved it; failures bring the question back with an error. |
| R-C9 | Moot (no coins). |
| R-C10 | Fixed: `storyBusyAt` waits up to 2 h after the saved day ends; unit-tested. |
| R-C11 / R-C12 | Fixed: an error line instead of "Counting…" forever; "Best streak so far". |
| R-C13 | Accepted (day = wake → next wake), DECISIONS. |
| R-C14 | Story chapters 3–6 + `cafe_open` built; barista outfit deferred (DECISIONS). |
| R-C15 | Fixed: migrations renamed to 20261113120000/130000/140000. |
| R-C16 | Added: close-while-asking → later (E2E CJ-CAFE-4), play refuses bedtime, year review outside December, water never asks. |
