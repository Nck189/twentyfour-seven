# G7 independent review: Economy v2 (market, orders, seed shop, ticket swap, upgrades, reward jar, harvest value, first-10 line)

- Reviewer: independent G7 subagent with no implementation context. Date: 2026-11-12.
- Checkout: `365ae13`. Diff reviewed: `9b65fcd..HEAD` (STORY.md excluded).
- Environment: local production build at http://localhost:3200 against local Supabase.
- Browser: Chromium with iPhone emulation (390×844, touch, Asia/Bangkok) and iPad portrait (810×1080).
- Scripts and screenshots: `/tmp/claude-0/-home-user-twentyfour-seven/70c331e7-c8a5-54e2-a6b6-8031bbfe6cac/scratchpad/g7-econ/`.
  - Attack scripts: `attack1.cjs` to `attack4.cjs`.
  - UI scripts: `ui1.cjs` to `ui5.cjs`.
  - Screenshots: the `shots/` subfolder, written below as `shots/<name>.png`.

## Verdict: **FAIL**

One S1: a race in `deliver_order` mints coins. There are also four S2s:
- Two are stale-shop bugs that break the harvest → sell loop and the coin balance.
- One is the reward card layout in Thai.
- One is the R8 rubric item, which scores below 4.

Server-side security is otherwise solid:
- Every new table has RLS.
- Direct writes, crafted arguments, anon calls and parallel double-spends were all rejected, except the delivery race in E1.

## Findings

| ID | Sev | Where | Steps | Expected | Actual | Evidence |
|---|---|---|---|---|---|---|
| E1 | **S1** | `deliver_order` (`20261112010000_market.sql`) | **(a)** Barn Lv ≥ 1, two of today's orders ask for the same crop, and stock covers only one. Call `deliver_order(slotA)` and `deliver_order(slotB)` at the same time (`Promise.all`). **(b)** Stock = order qty. Call `sell_produce(item, qty)` and `deliver_order(0)` at the same time. | One of the two calls fails ("not enough produce"). | **Both succeed.** (a) went 12/12: e.g. stock 1 lettuce paid 19 + 19; stock 3 paid 37 + 28. (b) went 7/15: the crop was sold and the order was paid too. Cause: the stock check (`sum(qty)`) runs before any row lock. The `for … for update` loop skips rows that went to `qty = 0` (EvalPlanQual re-check of `qty > 0`), so `need` stays above 0. The order is paid anyway, because there is no `need = 0` check after the loop. A user with two devices, or anyone with the anon key and their own JWT, can repeat this every day. | `attack2.cjs` output ("RACE 2 orders both OK", "RACE sell+deliver both OK") |
| E2 | S2 | `Shop` / `useMarket` (no refresh on farm changes) | On the farm, harvest a ripe plot (or collect animal produce), then look at Shop → Market without reloading. | The new produce is on the shelf, and the orders' "You have N" counts it. | The shelf still says **"Nothing to sell yet. Harvest a crop…"** right after "+1 Radish", and orders say "You have 0". It only updates after a page reload. `useMarket` refetches only after its own actions. This is the core harvest → sell/deliver journey. | `ui2.cjs`: "shelf after harvest (no reload): … Nothing to sell yet" / "shelf after reload: Radish ×1 … 58" |
| E3 | S2 | `Shop` header coins vs `DecorShop` (embedded) | Shop tab → buy decor (Fence 40, Pond 300). | The Shop's coin count and the enabled/disabled state of every button follow the real balance. | The Shop header stays at **498** while the server has **158**. Seeds, Swap and Upgrade buttons stay enabled on the stale balance. A server rejection then shows "Couldn't do that. Check your connection", which is wrong and misleading. | `shots/after-decor.png`; `ui3.cjs` "decor buy: shop header 498 → 498 \| server coins 158" |
| E4 | S2 | Rewards tab card (`Rewards` in Shop.tsx) | Add a long Thai reward (60 chars), view at 390px in TH and in EN. | The title stays readable and Thai breaks only between words. | The title is squeezed into a narrow column by price + Redeem + Remove: about 10 lines in the EN UI, 5 in TH. `[overflow-wrap:anywhere]` breaks Thai **inside syllables** ("ชาบูร้ / าน"). Even "Bubble tea" wraps onto two lines in EN. R5 is below 4 and it is broken in TH, so S2 by policy. | `shots/mix.png` (2nd and 4th panes), `shots/shop-3-th-light.png` |
| E5 | S2 | R8 Delight across the shop | Sell, Deliver, Swap, Upgrade, Redeem. | A small payoff: "+48" coin pop, "Delivered!", "Enjoy your bubble tea!", a visible house change. | The only feedback is a number changing (often off-screen, at the top of a long section) and a tick SFX, which is muted on many phones. Redeeming a 10,000-coin real-life reward gives no acknowledgement at all. House Lv 2→3 (2,000 coins) adds a 2px lintel and a tiny flower box that can't be seen at 64px. R8 = 3, so S2 by policy. | `shots/after-redeem.png`, `shots/house-all.png` |
| E6 | S3 | `deliver_order` ordering | Stock: turnip normal ×4 weather (×3), silver ×1, gold ×1. Deliver a 1× turnip order. | ECONOMY.md: "takes the lowest-quality matching produce first", so a normal one should go. | It took the **silver** one, because the code orders by `_sell_price` (lowest value). This is arguably better for the user, but it doesn't match the approved doc. Change the doc or the code, and record the decision in DECISIONS. | `attack3.cjs` "after …" inventory |
| E7 | S3 | `FarmScreen` harvest pop (`sellPrice(item, 0)`) | Stall Lv 2, then harvest a prismatic ×6 radish. | The pop states the real sale price. | The pop says **"Sells for 48 coins"**, but the market pays **58**. The stall level is ignored. | `ui2.cjs`, `shots/harvest-pop-en.png` |
| E8 | S3 | Market row subtitle | A crop with weather > ×4. | The label matches the multiplier that is actually paid. | It shows "Prismatic · **×6 value**", but the price uses ×4 (48 = 6 × 2 × 4). The player thinks they're being underpaid. | `shots/shop-0-en-light.png` |
| E9 | S3 | Rewards: Redeem / Remove | Tap Redeem, or Remove. | A confirm step or undo for an irreversible spend of up to 10,000 coins, or a deletion. | Both are one tap, with Redeem directly next to Remove. There is no confirm and no undo. | `ui3.cjs`, `ui4.cjs` |
| E10 | S3 | `Fertilized` line (BlockCheckin) | New user with an empty Work plot: tick the first-10. | Fertilizer is promised only when the block's plot has a crop, or the line says to plant one. | "Fertilizer for the Work plot: better quality, better price" shows even though the plot is empty, which is a false promise. | `shots/first10-en-light.png`; DB: no plots planted |
| E11 | S3 | Upgrades progress pips | House at Lv 0. | 3 pips (the house has 3 levels). | **2 pips** at Lv 0, then 3 from Lv 1. The `max` formula only looks 2 levels ahead. | `ui2.cjs` "house level 0: pips shown 2", `shots/upgrades-house0.png` |
| E12 | S3 | HarvestPop value line | Harvest on a farm with weather chips. | The pop text is legible. | The new "Sells for 48 coins at the market" line sits over the dimmed weather list with no backing, and the two collide ("Sells for 48 coins" over "Woke first 10 done"). | `shots/harvest-pop-en.png` |
| E13 | S3 | Orders pool (`_orders`) | Code inspection: the pool is starters plus every crop ever harvested, re-hashed when the pool grows. | Orders stay stable within a day and are fillable. | (a) Harvesting a new crop type mid-day can change which crop an unfilled order asks for. (b) Long-term players will mostly get orders for epic/legendary crops, e.g. "3 × Star fruit": 7 grow days, no regrow, unfillable unless hoarded. | `_orders` SQL |
| E14 | S3 | Economy balance (see §Economy) | Realistic play. | Rarer seeds are worth buying, and coins keep a pull. | A free common outearns every bought seed per plot-day, so the seed shop is a pure sink with no economic return. All upgrades (5,200) are done in about 4–6 weeks of normal play (about 9 days for a diligent player). After that, the only sinks are 300/week of tickets plus decor. | calculation below |
| E15 | S3 | Reward form / 0-coin states | Enter cost 5 or 99999999999999999999. Open the shop with 0 coins. | A short hint, e.g. "10–10,000 coins" or "need 30 more". | The Add button just goes disabled with no reason. At 0 coins every button is greyed out with no hint. | `ui4.cjs`, `shots/zero-all.png` |
| E16 | S4 | Server edge cases | — | — | `buy_seed(null)` passes the offer check (`null = any(..)` is null) and fails with "not enough coins". A reward title of 5,000 spaces + "x" is accepted (`btrim` only applies inside the check). There is no limit on the number of rewards. Adding or removing a reward writes no `events` row. | `attack1.cjs` |
| E17 | S4 | Copy / format | — | — | A "Shop" tab inside the "Shop" section ("Shop → Shop"). Costs show as "10000" with no thousands separator. The shop doesn't refresh at the wake-day rollover while open, so buying a stale offer gets the generic "check your connection" error. | screenshots |
| E18 | S4 | Timezone | Switch the profile to a later timezone. | — | This can pull the next wake-day's offers, orders and ticket week forward once. It can't be repeated, because switching back is refused. | code (`profiles_timezone_after`) |

## Conformance with ECONOMY.md

| Item | Result | Evidence |
|---|---|---|
| Price = round(base × quality × min(weather, 4) × stall). Base, produce, quality and stall values as in the doc. Older `crop:<id>` = normal. | PASS | Prismatic ×6 radish = 48, ×1.2 = 58. Gold ×3 tomato = 45, ×1.1 = 50. Prismatic ×90 melon at stall 2 = 154. Old carrot = 6. Integration price-parity test passes. Note: `golden_egg` 20 and `gift` 15 exist in code but not in the doc (S4 doc gap). |
| Server judges quality/weather at harvest; item stored `crop:<id>:<q>:<m×100>` | PASS | `harvest_plot` → `crop:radish:prismatic:600`. Parallel harvest ×10 → 1 succeeds, including regrow crops. |
| Seed shop: 3 offers/day (2 uncommon + 1 rare), 30/80, hash of (user, wake-day), others refused | PASS | Non-offered seeds, commons, epics and SQL-ish strings → 22023. Note: the quantity per offer is unlimited (the doc doesn't say), and `buy_seed(null)` is E16. |
| Ticket swap 150 → 1, at most 2 per Monday-based week | PASS | Parallel ×10 → 2 succeed, 300 coins spent, +2 tickets. Last week's rows aren't counted. |
| Upgrades: prices, caps, one level at a time | PASS | Stall 200/500, barn 300/800, house 400/1000/2000. Parallel ×10 house → exactly 3 levels for 3,400. "already at the top" after that. |
| Daily orders: count = 1 + barn | PASS | 1 / 2 / 3. |
| Order reward = round(1.5 × normal value) + 10 | PASS | 1× radish 19, 2× 28, 3× 37. |
| Each order filled once | **FAIL (E1)** | The same slot ×10 → 1 succeeds. But **two slots sharing one stock** are both paid, and so are sell + deliver on the same stock. |
| Lowest quality taken first | **FAIL (E6, S3)** | Lowest *value* is taken first instead. |
| Reward jar: own rows, RLS, title ≤ 60, cost 10–10,000 | PASS | Insert/select/update/delete of another user's reward is blocked, and so is moving a reward to B. Cost 0/−5/10001 and 61 chars are rejected (whitespace edge in E16). |
| `redeem_reward` spends coins and logs `reward_redeemed`; other users' / archived ids refused | PASS | Parallel ×10 with coins for 2 → 2 succeed. Another user's id, a random id and an archived id → P0002. The event is logged. |
| Harvest pop shows the value | PARTIAL (E7) | It shows the value, but ignores the stall level. |
| First-10 "fertilizer" line (EN/TH, at the tap, reduced motion honoured) | PASS with E10 | It shows at the tap, disappears on untick, has Thai copy, and has a reduced-motion/skip guard. It also shows for empty plots. |
| Reward jar hint at ≥ 300 coins, once per browser, quiet | PASS | Shown at 320 coins with "OK", stored in localStorage. |
| All strings via i18n EN/TH | PASS | `i18n:check` 839 keys OK. No hardcoded strings found in the new components. |
| Every coin/ticket change in a security definer RPC checking `auth.uid()` | PASS (except the E1 logic bug) | All 7 RPCs raise 42501 for anon, and the internal `_` helpers aren't callable. |
| RLS on every new table | PASS | `upgrades`, `order_deliveries`, `ticket_exchanges`, `reward_redemptions`: select-own only, and client insert/update/delete → "permission denied". `rewards`: CRUD on own rows only. Anon: denied on all. `inventory`/`game_state`/`plots` writes by the client → RLS violation or 0 rows. |

## Cheat attempts (summary)

All of the following were **blocked**:
- Direct writes to `inventory` (insert/upsert), `game_state`, `upgrades`, `order_deliveries`, `ticket_exchanges` (insert/delete), `reward_redemptions` and `plots`.
- `events` writes of the economy types.
- Rewards inserted for another user, reading/updating/deleting B's reward, and redeeming B's reward.
- Crafted `sell_produce` calls: fake item `crop:radish:prismatic:9000` → not enough to sell; quantities −5, 0, 2^31−1 and null → bad quantity; 1.5 → type error; null item.
- Seeds not offered today; unknown upgrade tracks; delivering slots 3, −1, 99 and null.
- The internal helpers (`_sell_price`, `_orders`, `_seed_offers`, `_upgrade_level`, `_earned_mutations`): permission denied.
- Every RPC and table as anon.
- Parallel ×10 on exchange, upgrade, seed, same-slot deliver, redeem, sell and harvest: all held their limits.

**Not blocked:** the E1 delivery race.

Residual risk outside this change: the habit inputs that drive quality and weather (`block_logs` first-10, checklist and location for today) are self-reported and client-writable by design. The market now turns those claims directly into coins (up to ×8 base per crop), so the honour system is worth more than it was.

## UI checks (iPhone 390×844 unless noted)

| Check | Result |
|---|---|
| Double-taps | Buy seed, Swap, Sell 1, Upgrade, Redeem and Add reward each spent exactly once. |
| Offline mid-sell | A friendly alert appears, no coins are lost, and retrying after reconnecting works. Note: the same "check your connection" text is shown for every server rejection. |
| Reload | State is consistent. The selected tab resets to Market (acceptable). |
| Empty shelf | Has an empty state. |
| 0 coins | Disabled buttons, but no explanation (E15). |
| Long Thai title | Fails (E4). |
| TH + dark | Renders with no tofu or clipping, apart from E4. |
| Horizontal scroll | None: scrollWidth = viewport on all 4 locale/theme combos and on iPad. |
| iPad portrait 810×1080 | Fine (`shots/ipad-farm-small.png`). |
| House on the farm, Lv 0–3 | Lv 0 draws nothing. Lv 1–3 grow and sit on the field edge (`shots/house-all.png`, `shots/house-3-zoom.png`). |

## Rubric (§4.3)

| # | Score | Note |
|---|---|---|
| R1 Style | 4 | The farmhouse is flat, 3-tone, top-left light, tokens only. The window rim is a soft same-hue darker shape (allowed). The fertilizer sparkle is flat. Art lint: 0 violations. |
| R2 Consistency | 4 | The house matches the crop/decor set, though its roof highlight is a bit more "glossy wedge" than other assets. |
| R3 Readability | 4 | Crops and produce are readable at 44–48px in the shop lists. The house at 64px is readable, but its level differences aren't (see R8). |
| R4 Layout | 4 | No horizontal scroll and safe areas are fine. Market rows are tall: price top-right, buttons alone on a second line, with a lot of empty space. The harvest-pop text collides with the page behind it (E12). |
| R5 Typography | **3** | Thai reward titles break inside syllables in a squeezed column (E4). Otherwise the hierarchy is OK and Thai line-height is good. |
| R6 Color & contrast | 4 | Dark mode is intentional. Disabled buttons are low-contrast (expected). |
| R7 Motion | 4 | The fertilizer pop is spring-based and honours reduced motion and the skip setting. The new pop value line fades in with a delay even when the skip setting is on (minor). |
| R8 Delight | **3** | Selling, delivering, redeeming and upgrading have no reward moment. The top house upgrade is visually negligible (E5). |
| R9 Not AI-looking | 4 | No emoji or gradients. Hand-built shapes. |

## Economy sanity

These numbers come from the shipped formulas.

**Income per plot-day, normal quality, no weather:**

| Crop | Income per plot-day |
|---|---|
| Common (free) | 6 |
| Uncommon (30, regrows every 2 d) | 5 |
| Rare (80, 3 d) | 5.3, minus the seed cost |
| Epic | 6 |
| Legendary | 8.6 |

The ×4 weather cap applies to every crop the same way. Longer crops collect more mutations but are already capped, so commons stay the best money crop:
- A prismatic ×4 radish sells for 48 (58 at stall 2).
- A rare seed's best possible harvest is 154 after 3 success days. A free radish on the same plot makes 3 × 58 = 174.

So:
- There is **no buy-seed → sell-crop exploit**.
- The seed shop is economically pointless. It only buys collection, dex progress and new order types.

**Realistic play (backlog 50–100/day, about 3 harvests/day at silver/gold with ×2–3 weather):**

| Source | Coins per day |
|---|---|
| Backlog | 50–100 |
| Harvests (about 19 each) | about 55 |
| One order | about 25 |
| **Total** | **about 130–180** |

- Every upgrade (5,200) is bought in about 30–40 days.
- A diligent player (7 prismatic radishes/day + 3 orders + 150 backlog) makes about 575/day and finishes in about 9 days.
- After that the only recurring sink is 300/week of tickets plus decor. The "long-term pull" goal in DECISIONS 2026-11-11 is at risk.

Orders vs market:
- A normal-quality order pays about 3× market value, so orders are worth doing.
- High-quality produce is better sold. The server delivers the cheapest produce first, which suits this.
- Orders for rare and higher crops become hard to fill (E13).

## Top 3 improvements

1. **Make `deliver_order` atomic (E1, S1).**
   - Lock the matching inventory rows (`select … for update`) *before* checking the total.
   - After the loop, `raise` if `need > 0`.
   - Add a parallel test to `tests/integration/market.test.ts`: two same-crop slots, and sell + deliver.
2. **One source of truth for the shop.**
   - Refetch `market_status` whenever the farm reloads (harvest, collect, decor buy, wake-day change).
   - Better still: lift coins and shelf into one store shared with `useFarm`.
   - This fixes E2, E3, E17 and makes the harvest pop use the real stall price (E7).
   - Show the capped multiplier on the shelf (E8).
   - Map server errors to real messages ("Not enough coins", "Limit reached this week").
3. **Give economy actions a payoff and safety.**
   - A "+N" coin pop on sell/deliver.
   - A confirm sheet plus a small celebration on Redeem ("Enjoy: <title>").
   - Undo on Remove.
   - Lay out the reward card with the title on its own full-width line, and drop `overflow-wrap:anywhere` for Thai (E4).
   - Make house Lv 3 visibly bigger or richer (E5).
   - Rebalance seed value per day (for example, uncommon/rare base ≥ 2× and 3× common per day) so bought seeds earn their price (E14).

---

## Re-review (c03890a)

**Verdict: PASS.** E1 is fixed, and so are E2, E3 and E4. E5 is mostly fixed: its remaining gap is now an S3. No new S1 or S2 was found. Four S3s and four S4s remain or are new, listed under "New / remaining" below.

**How this was tested:**
- The app server on :3200 was a stale process from before the rebuild: its JS chunks returned 500. I restarted it from the `c03890a` build, then re-ran every original repro script and added new ones (`attack5.cjs`, `ui6.cjs`, `ui7.cjs`, `ui1b.cjs`).
- The new screenshots are in `/tmp/claude-0/-home-user-twentyfour-seven/70c331e7-c8a5-54e2-a6b6-8031bbfe6cac/scratchpad/g7-econ/shots2/`.
- The fixed function bodies are live in the DB, which I confirmed by reading `pg_proc`.
- Unit tests plus the market, farm and RLS integration tests: **373/373 pass**.
- `i18n:check` passes (849 keys), and the art lint shows 0 violations.

| ID | Status | Evidence |
|---|---|---|
| E1 (S1) delivery race | **Fixed** | Same-crop two-slot race: **0/12** (was 12/12). Sell + deliver race: **0/15** (was 7/15). New triple race (two deliveries + two sells on mixed old/gold stock, 20 trials): **0 inconsistent** (units consumed + units left = stock every time, never negative). Parallel ×10 still holds every limit: exchange 2, house 3 levels, seeds 3, same-slot deliver 1, redeem 2, sell 3. Deadlock stress (6 rounds of 13 mixed RPCs in parallel: sell, deliver, buy_seed, exchange, upgrade, harvest, buy_decor, plant): no `40P01`, only the expected refusals. |
| E2 (S2) stale shelf after a harvest | **Fixed** | Harvest without reloading → shelf shows "Radish ×1 · Prismatic · ×4 value · 58" and orders refresh (`ui6.cjs`). |
| E3 (S2) stale coins after buying decor | **Fixed** | Buy Fence → shop header 1000 → **960**, server 960. Coins drained on the server, then tap Swap → "The shop said no: not enough coins, or this week's limit is reached." and the header resyncs to 0. Switching tabs reloads. |
| E4 (S2) reward card in Thai | **Fixed** | Two-line rows. The 60-char Thai title wraps at word boundaries across the full width in both TH and EN, and "Bubble tea" stays on one line (`shots2/mix2.png`). R5 → 4. |
| E5 (S2) no payoff | **Fixed, with a new S3 (N1)** | Payoff lines appear with a coin pop: "+58 coins from the market", "Tomato seed is in your bag…", "Enjoy Movie night! −100 coins…". House Lv 3 is now wider, with an attic window and porch posts, and is clearly distinct (`shots2/house3-zoom.png`). R8 → 4. |
| E6 (S3) lowest quality first | **Fixed** | Stock: normal ×4 weather (×3), silver ×1, gold ×1; a 2× order → both normal units taken, silver and gold kept. |
| E7 harvest pop ignores stall | Fixed | Stall Lv 2: pop "Sells for **58** coins" = market price 58. |
| E8 weather label | Fixed | "Prismatic · ×4 value" for a ×6 crop. |
| E9 one-tap Redeem | **Not effectively fixed (S3, N2)** | See N2. |
| E11 upgrade pips | Fixed | "Level 0/2", "Level 1/2", "Level 3/3", with pips per track. |
| E10, E12–E15 | Not changed (deferred as stated) | The harvest-pop text still overlaps the weather list (`shots2/harvest-pop.png`). |

### New / remaining (no S1 or S2)

| ID | Sev | Where | Finding |
|---|---|---|---|
| N1 | S3 | Shop payoff line | The payoff sits at the top of the Shop. With a typical shelf (8 items), selling a lower row puts it **576px above the viewport**: nothing visible changes on screen, and the coin header is off-screen too. Only the sound remains, which is often muted. Fix: show it as a toast near the tapped row, or a fixed toast above the tab bar (`ui7.cjs`, `shots2/payoff-long-shelf.png`). |
| N2 | S3 | Rewards: two-tap redeem | "Spend N coins" renders exactly where "Redeem" was, so a **double-tap on Redeem spends the coins** (repro: 1028 → 928, 1 redemption, `ui6.cjs`). The confirm only protects against a single accidental tap. Fix: put the confirm in a different position or a sheet, ignore taps for about 400 ms after it appears, or move Cancel to the right. |
| N3 | S4 | `useMarket` refusal mapping | Every P0001/P0002/22023 error shows "not enough coins, or this week's limit is reached". That message is wrong for "already delivered", "not enough produce", "not in the shop today" (offers rolled over while the page was open) and "no such reward". |
| N4 | S4 | Copy / layout | The Thai "enjoy" line ends with "สมควรได้แล้ว", which reads stiffly; something like "เก่งมาก สมควรได้รางวัล" would be more natural. Order rows show the coin amount twice: "37" in the top line and "Deliver · 37" on the button. |
| N5 | S4 | Process | The fix edits the already-numbered migration `20261112010000_market.sql` in place. That's fine only because this migration has never been applied outside local (`origin/main` doesn't contain it; the economy branch is unmerged). If any preview or remote DB has applied it, it won't get the fix; add a new migration in that case. |

### Rubric after fixes

| R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 | R9 |
|---|---|---|---|---|---|---|---|---|
| 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 |

R8 is 4 with N1 noted.
