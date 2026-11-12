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

## Re-review (G7 round 2, 2026-11-13): `git diff 31f7193..ac01e00`
Covers 91f022f (the coffee → bedtime insight), 4c850ac (chapters 3–6 + `cafe_open`, `story_chapters` migration, new scenes, FarmSign) and ac01e00 (the fixes).

### What I ran
| Check | Result |
|---|---|
| `tsc`, `eslint .`, `prettier --check` on changed files, `i18n:check` (1015 keys), `art:lint` | all pass |
| `vitest run tests/unit` | 344/344 |
| Integration: cafe, snow-story, story, seasonal-story, rls | 95/95 |
| Probe: 5 parallel `claim_story_beat('ch4_sunset')` | 1 ok, 4 "already seen"; exactly 1 `farm_sign` row |
| Probe: bedtime paths | no order → refused; water only → refused; latte left unanswered → the bedtime insert works, and a later `answer_coffee` is refused; "play" → bedtime refused |
| Probe: `add_real_cup` | refused without a "yes"; on a "yes" day it keeps the latest slot and logs `coffee_cup_added` |
| Probe: brand-new account backfills 30 days, then claims `ch6_album` | **granted, tickets 0 → 2 on day one** (R2-1) |

### Fix verification
| ID | Verdict |
|---|---|
| R-C1 | **Verified.** Later cards return `{card: n}`; no coins or tickets move (tested). |
| R-C2 | **Verified.** `year_review` uses the season-year, and the 2027-01-05 case returns 2026. |
| R-C3 | **Verified.** Art lint is clean. |
| R-C4 | **Verified.** Only coffee/tea asks (`_cafe_caffeine`, parity-tested); `drink` is stored; `answer_coffee` needs a caffeinated order that wake-day. |
| R-C5 | **Verified.** `add_real_cup` keeps the latest slot, and the button shows only on "yes" days. |
| R-C6 | **Verified.** An unanswered caffeinated order gets one bedtime question (server insert path plus `ordered` in the status). |
| R-C7 | **Mostly.** "Noted" now waits for the server and failures restore the question. The "already answered" case still loops (R2-3). |
| R-C8 | **Verified.** |
| R-C9 | **Moot** (no coins). |
| R-C10 | **Verified.** `storyBusyAt` waits 2 h after the saved day ends (unit-tested). Auto-quiet is not guessed, which is logged. |
| R-C11 | **Verified.** |
| R-C12 | **Verified** ("Best streak so far"). |
| R-C13 | **Accepted** in DECISIONS. OK. |
| R-C14 | **Verified.** Chapters and the café scene are built; the barista outfit is deferred and logged. |
| R-C15 | **Verified.** The names are strictly increasing and not on prod. |
| R-C16 | **Verified** for (b), (c), (d) and (f). (a) the order race is still only covered by my probe; the story claim race is tested. |

### New findings
| ID | Sev | Where | Failure scenario | Suggested fix |
|---|---|---|---|---|
| R2-1 | **S1** | `supabase/migrations/20261113140000_story_chapters.sql:37, 62, 85` | **Chapter 6's 2 tickets can be claimed on a new account's first day.** `days_used` counts *any* wake event, backfills included, and `backfill_wake` accepts the past 30 days even before the account existed. A brand-new account can backfill 30 days and claim `ch6_album` at once (reproduced: tickets 0 → 2). STORY.md: "30 days used". Gifts must be decided from real data. | Count only days the app was really used, on or after the account's creation date, e.g. `not w.backfilled` (or live wakes plus Night rituals) and `w.date >= created_on`. Add an integration test that 30 backfills don't unlock ch6. |
| R2-2 | S3 | `content/story.ts` chapters 3–9 vs seasonal 70+; `lib/game/director.ts:75` | **Evergreen chapters delay the month-only seasonal beats.** When this ships, an existing user with animals, a 7+ best streak and Farmhouse 1–2 has ch3, ch4, ch5, ch6 and `cafe_open` queued; at one beat per wake-day that's up to 5 calm days first. A user who visits the Farm rarely can then miss a month's beat (Lotus/Snow opening or market) until next year. The snow opening line also says seeds are on sale "until the 14th". | Sort the month-only seasonal beats (`season` triggers) before the evergreen chapters, which can always wait. Add a director unit test. |
| R2-3 | S3 | `components/farm/CafeSheet.tsx` `reply()` | **"Already answered" loops.** If the day was answered elsewhere (another tab or device, or a bedtime answer), every reply fails with "Couldn't reach the café" and the question comes back. The menu stays disabled until the sheet is closed. | Treat P0001 "already answered" as done (reload), or hide the question when `cafe.status.answer` is set. |
| R2-4 | S3 | `messages/th.json` `stats.coffee.from` / `collecting`; EN `stats.coffee.*` | **The insight wording misdescribes the groups.** In TH, `{other} วันที่ไม่ได้กิน` reads as "days you didn't drink any", but `other` also holds morning-coffee days. EN/TH both say "coffee" although tea now counts. | TH: "วันที่ไม่ได้ดื่มช่วงบ่าย/เย็น". EN/TH: "coffee or tea". |
| R2-5 | S3 | `story_chapters.sql:125-127` | **Story tickets skip the ledger.** Story tickets (ch2's 1, now ch6's 2) are added directly to `game_state` instead of going through the ticket ledger (`ticket_grants` and the `ticket_granted` event) that other ticket sources use. The pattern pre-exists, but now there are more tickets. | Use `_grant_tickets(uid, n, 'story', …)`. |
| R2-6 | S4 | `cafe.sql:238` | The bedtime insert stores `drink = null` although a caffeinated order exists. | Store `_cafe_last_caffeine(uid, d)`. |
| R2-7 | S4 | `messages/*` `ch4_sunset.l1`, `cafe_open` | `ch4` plays on a best-ever streak of 7, possibly long after a lapse, yet says "Seven days in a row" as if current. `cafe_open` ("has opened") plays for users who already use the café. Both are expected per the "waits for a calm moment" rule. | Soften: "You once kept it up for seven days…" / "The café has a proper sign now". |
| R2-8 | S4 | `story.gift.decor` EN | "Gift: the Farm sign for your farm" has a capital letter mid-sentence and says "farm" twice. | "Gift: a farm sign" (lower-case the decor name, or use a separate key). |
| R2-9 | S4 | `cafe.sql` night path | If game-only is turned off after an order made while it was on, bedtime asks about a day whose popup never showed. | Ignore; or store `asked` on the order. |
| R2-10 | S4 | `claim_story_beat` | The server doesn't enforce chapter order (e.g. ch6 before ch0). The client always picks the lowest chapter. | Optional: require earlier evergreen chapters to have been seen. |

### Checked and OK (round 2)
- **Chapter triggers:** the SQL matches `content/story.ts` and STORY.md (hatched ≥ 1, best streak ≥ 7, house ≥ 1, 30 days used, house ≥ 2 for the café). The gifts mirror the content and are tested.
- **Decor gifts:** the farm sign is granted once under parallel claims (the `game_state` lock plus the "already seen" check after it).
- **New RPCs and helpers:** `add_real_cup` is executable by authenticated users only; the new `_cafe_*` helpers are revoked. `coffee_cup_added` is on the events deny-list.
- **The café is never locked behind `cafe_open`:** the button still depends only on Farmhouse ≥ 2.
- **Insight:** it uses only answered days ("play", unanswered and "later" with no bedtime answer are excluded), needs 8+ days on each side, and says "It looks like…".
- **New scenes and FarmSign:** they pass the art lint; EN/TH keys are complete.

### Verdict (round 2)
**FAIL.** 1 × S1 open (R2-1). No S2. 4 × S3 (R2-2..R2-5) and 5 × S4. Fix R2-1 test-first; re-checking R2-1 alone is enough for PASS.


## Fixes after the re-review (2026-11-13)
| ID | Status |
|---|---|
| R2-1 (S1) | Fixed test-first: `days_used` counts only live "I'm up" days on or after the account's creation date (local). New integration test: a new account with 30 backfilled + 30 pre-sign-up live days gets `days_used = 0` and can't claim `ch6_album`; the chapter test now needs 30 live days after sign-up. |
| R2-2 (S3) | Fixed: the director plays first-week chapters 0–2, then month-only seasonal beats, then chapters 3+ (unit-tested both ways). |
| R2-3 (S3) | Fixed: an answer on an already-answered day says "You already answered today" (the first answer stays), no error loop. |
| R2-4 (S3) | Fixed: the insight says "coffee or tea" and the other group is "other days (none, or only in the morning)" in EN and TH. |
| R2-5 (S3) | Accepted: story tickets are recorded in `story_seen.gift` + the `story_seen` event (the existing pattern for ch2); a shared ticket ledger is a separate cleanup. |
| S4 "Farm sign" capital | Fixed: "Gift for your farm: {item}". Other S4s accepted. |
