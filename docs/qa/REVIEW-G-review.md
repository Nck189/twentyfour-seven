# G7 independent review: Big buys ask first + Farm yard (branch phase-g-local)

Scope: `git diff origin/main...HEAD` (f659258 … 31ddd91). Reviewer: independent QA (read-only), 2026-11-23.

**Verdict: PASS** (no open S1/S2; 4 × S3, 7 × S4 below)

## Checks run
- `npx tsc --noEmit -p .`: clean. ESLint on all changed files: clean.
- `npx vitest run` (unit + integration, local Supabase, migration applied): 115 files, 763/763 passed.
- `scripts/i18n-check.ts`: 1339 keys, en = th. `scripts/qc-art-lint.ts`: OK (23 art files, 74 tokens).
- Live DB:
  - ACLs:
    - `place_decor` and `store_decor` can be run by authenticated (not anon).
    - `_decor_first_spot`, `_decor_place_new`, `_story_facts` and `_story_ready` can be run by postgres and service_role only.
    - All of them are `security definer` with `search_path=''`.
  - `decor` column grants: authenticated can UPDATE only `x` and `y`, never `spot`. INSERT exists at table level but RLS has no insert policy (`rls.test.ts:126` still refuses it).
- Concurrency probe on the local DB (two transactions, both rolled back): two decor inserts for the same user with no lock both target spot 1. The second one blocks on the unique index, so if the first commits, the second fails with a unique violation (see S3-1).
- I did not run E2E (as instructed). I read the specs: the shop, factory and seasonal specs click the new "Buy this?" sheet, and no other E2E buys decor or machines.

## What holds
- **Migration ordering and backfill:** the column is added, then the unique index is built (every spot is still null, so it can't fail), then the backfill runs. The backfill uses `row_number() over (partition by user_id order by created_at, id)`, so each user gets spots 1–8 with no collisions, and the 9th item onward stays in storage. The trigger is created after the backfill, and everything runs in one migration transaction.
- **Every `insert into public.decor` still works unchanged:**
  - `buy_decor` (m9)
  - `_grant_unlock` (m9), called from `claim_unlocks`, `claim_setup_rewards` and `report_home_screen`
  - `order_drink` (café)
  - `claim_story_beat`

  The trigger only fills `spot` when it is null. A multi-row INSERT also gets distinct spots (I checked, then rolled back).
- **Money is safe:** each spender is one transaction, so a unique violation rolls back the coin debit along with it. `buy_decor` updates the `game_state` row before its insert, so two buys at once are serialized and the second one sees the first one's spot.
- **`place_decor` swaps correctly** in every case, and the update order (item → null, other → item's old spot, item → target) never breaks the partial unique index. The cases:
  - yard → free spot
  - yard → taken spot (a swap)
  - storage → taken spot (the item that was there goes to storage)
  - the same spot again (no-op)

  It also checks the owner (`user_id = uid`, P0001), the range (22023) and auth (42501), and two tabs are serialized on the `game_state` row lock. `store_decor` checks the owner too.
- **The `_story_facts` / `_story_ready` redefinition copies `20261123000000_milestone_beats.sql` exactly.** I diffed them: the only changes are the `festival_set` fact and the `yard_festival` case. `_story_gift` returns null for the new beat (no gift). The client trigger (`festival_set`) matches the server.
- **Confirm threshold:** `price >= 100 || price*4 >= coins`, and price ≤ 0 never asks.
  - It is wired into every coin spender: `buy_seed` (normal and seasonal), `exchange_ticket`, `buy_upgrade`, `buy_decor`, `buy_machine` and `upgrade_machine`. `redeem_reward` keeps its own two-tap. `start_job`, the café and gacha don't spend coins.
  - Coins left = the live `coins - price`. Every button is disabled when you're short, so "left" can't go negative.
  - EN and TH read naturally.
- **Yard:**
  - At 390 px (358 px inside the card), all 8 spots fit horizontally and targets are 44 px.
  - Buttons have names; Som and the visitors are `aria-hidden`.
  - Visitors drift only without Skip animations, and the global reduced-motion rule stops them.
  - Empty spots show only when storage has items. With 0 items the component returns null, which is correct because there is no storage to reach.
  - With every item in storage, the band shows the 8 "+" spots and the tray.
  - Tokens only; no black.
- **Share picture:** the 5-piece layout was already covered by `layoutScene` and its unit test (0–5 pieces stay on the card and on the ground). Decor goes through the same `Slot`/token-resolve pipeline as crops and animals.

## Findings

### S3-1 · A race can make a reward claim fail (unique violation): `report_home_screen` doesn't lock
`supabase/migrations/20261124000000_farm_yard.sql:26-41`, `supabase/migrations/20261103080000_m7_setup_rewards.sql:147-160`
- **What happens:** the trigger picks the "first free spot" without a per-user lock. Every insert path serializes on the `game_state` row except `report_home_screen` (which grants `flowers`). On the first Home Screen launch, `ProfileSync` calls it at the same time as `TodayScreen`'s `claim_setup_rewards` / `claim_unlocks`, which can grant `wind_chime`, `garden_lantern` or `mailbox`. `place_decor` can also race it. When both pick the same spot, one transaction fails with 23505.
- **Impact:** no data or money is lost (everything rolls back). The claim retries on the next mount or launch. But a one-time reward can fail silently once, and the race didn't exist before this migration.
- **Fix:** in `_decor_place_new`, take the same lock as everyone else before computing the spot: `perform 1 from public.game_state where user_id = new.user_id for update;`. Alternatively, add that line to `report_home_screen`. Add an integration test with two parallel inserts.

### S3-2 · Som is mostly cut off at spots 1 and 7, the usual case
`components/farm/Yard.tsx:95-99`, `content/yard.ts:7,13`
- **What happens:** Som is drawn at `-left-7` (−28 px) of the item's box. At spot 1 (x 8%), the box's left edge is about 6.6 px, so about 2/3 of Som falls outside the `overflow-hidden` band. At spot 7 (x 6%), about 90% is clipped.
- **Impact:** spot 1 is filled first, and backfilled users and anyone with one item always have it. "Som visits decor" is mostly invisible for exactly those users.
- **Fix:** place Som on the inner side, mirrored (`left-full`), when the spot's x < 0.5. Add a unit or E2E check that Som's box stays inside the band.

### S3-3 · Escape on the buy confirm also closes the Factory sheet
`components/farm/FactorySheet.tsx:166,201`, `components/today/BlockSheet.tsx:26`
- **What happens:** the confirm `Sheet` is nested inside the Factory `Sheet`. Each `Sheet` adds its own `window` keydown listener, so one Escape (meaning "cancel the buy") closes both. Focus also falls to `<body>` when the inner sheet closes.
- **Impact:** no purchase happens, but the user loses their place, and keyboard users lose focus.
- **Fix:** in `Sheet`, stop handling Escape once it's handled (e.g. `stopImmediatePropagation` in a capture-phase listener on the innermost dialog, or a module-level sheet stack where only the top sheet reacts). Return focus to the opener when the inner sheet closes.

### S3-4 · Deploy order: the Farm tab breaks if the client ships before `db push`
`lib/farm/useFarm.ts:102,106-107`
- **What happens:** `select("id, item_id, spot")` errors on a DB without the column, and `decorRows.error` is thrown, so the whole Farm screen goes to its error state for every user.
- **Mitigation:** the plan says "Needs db push before merge". The reverse order is safe: the old client ignores the new column and the trigger.
- **Fix:** keep this as a release gate (push the migration first, then merge). Optionally, fall back to `select("id, item_id")` with `spot: null` on error, as `upgrades` already does.

### S4-1 · Festival integration test is a false green in 6 of 12 months
`tests/integration/yard.test.ts:66-82`, migration `:158-162`
- **What happens:** the test returns early when the month has no festival item, and its festival map is hard-coded (copied from content).
- **Fix:** make `festival_set` use `public._season_day(uid)`, the same day the other beats use (`d`). In production it equals `_wake_day`, since `season_clock` is service-role only. Then pin the month with `season_clock` (e.g. 2026-11-20 → `krathong`), as `seasonal-story.test.ts` already does, so the test runs every month. Import the festival ids from `content/seasons.ts`.

### S4-2 · Som's span can catch taps meant for spot 3
`components/farm/Yard.tsx:96`
- **What happens:** Som's span has no `pointer-events-none`. When Som sits at spot 5, it covers about 22×12 px of spot 3's button, and that part of the button doesn't respond. At spot 3, Som also overlaps spot 7's art.
- **Fix:** add `pointer-events-none`; this pairs with the S3-2 fix.

### S4-3 · Spots 7 and 8 are clipped about 2 px at the bottom
`content/yard.ts:13-14`, `Yard.tsx:73`
- **What happens:** `top = 8 + 0.85*64 = 62.4%` of 112 px plus 44 px reaches 113.9 px, past the 112 px band. The soft ground shadow gets cut.
- **Fix:** use y ≤ 0.8, or `top: 6 + y*60`.

### S4-4 · The night veil also covers the storage tray
`components/farm/FarmScreen.tsx:337-342`, `Yard.tsx:139-160`
- **What happens:** at night, the farm-scene veil (`absolute inset-0`) tints the tray's UI chrome and its muted label, which lowers contrast.
- **Fix:** render the tray outside the veiled `relative` div, or give the veil `bottom` equal to the tray's height.

### S4-5 · A full yard sends a new buy to storage with no notice
`components/farm/DecorShop.tsx`
- **What happens:** with all 8 spots full, a purchase lands in storage silently, and only the tray count changes.
- **Fix:** show a short notice ("Went to storage: the yard is full"), or mention it in the confirm text.

### S4-6 · The factory capacity upgrade confirm reads awkwardly
`components/farm/FactorySheet.tsx:340`
- **What happens:** the confirm reuses the aria string, giving "Give the Jam jar more space, level 2 for 80 coins."
- **Fix:** add a `shop.confirm.machineUpgrade` key, e.g. "{name}: more space, level {n}".

### S4-7 · Docs and server nits
- `docs/FARM_YARD_PLAN.md:12,25` still says "Dragging on the farm does the same" and "then drag", and `:6` says spots are "around the plots and the farmhouse". DECISIONS (no drag; a band below the plots) says otherwise, so align the plan.
- `store_decor` on an item that's already in storage still writes a `decor_stored` event with `from: null` (migration `:96-103`). Return early instead.
- The backfill is idempotent only until users move items. A manual re-run after that could collide, which is harmless for a one-shot migration.
