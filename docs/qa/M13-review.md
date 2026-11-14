# M13 — G7 independent review (Factory)

- **Scope:** `git diff cc42a3d..HEAD` on `m13-local` at `e81ccc7`. This covers:
  - `content/factory.ts`, `lib/game/factory.ts` (queue rules + KPI), `lib/game/market.ts` (product items)
  - `lib/factory/useFactory.ts`, `components/farm/FactorySheet.tsx`, `FarmScreen.tsx` (entry), `Shop.tsx` (shelf)
  - `components/art/farm/Factory.tsx`, `app/globals.css` (puff)
  - migration `20261114000000_factory.sql`, `lib/export/tables.ts`, messages EN/TH
  - `lib/share/compute.ts` (R-M12-14)
  - the unit, integration and E2E tests
- **Reviewer:** a fresh G7 subagent with no implementation context.
- **Date:** 2026-11-14.

## What I ran
| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| ESLint on the changed TS/TSX; Prettier on the changed files | clean / clean |
| `i18n:check` | 1180 keys, EN = TH |
| `art:lint` | OK (20 art files, 73 tokens); every `var(--art-*)` in `Factory.tsx` exists in `styles/tokens.css` |
| `npx vitest run tests/unit` | 59 files, 387/387 pass |
| Integration: `factory`, `rls`, `market`, `share` | 4/4 and 106/106 pass |
| Events deny list | I diffed it against `20261113180000_share.sql` (the latest earlier definition) with a script. Removed: none. Added: `machine_bought`, `machine_upgraded`, `job_started`, `jobs_collected`. |
| `_sell_price` redefinition | I compared it line by line with `20261113100000_seasonal.sql`. The produce and crop branches are identical, and only the `product:` branch is new (prepended). The 2-arg wrapper is untouched. |
| `pg_proc` probe | Every factory RPC is `security definer` with `search_path=""`. `buy_machine`, `upgrade_machine`, `start_job` and `collect_jobs` are executable by `authenticated` (+ `service_role`). `_factory_catalog`, `_stock_of` and `_sell_price` are not executable by clients. |
| Live probes (scratch script, local Supabase, real user JWTs) | See "Checked and OK" and R-M13-1. |
| JS rounding of `minutes × factor` for every recipe and level | The only non-integers are 19.5, 29.25 and 58.5. They are exact in binary, so `Math.round` = SQL `round(numeric)` (20 / 29 / 59). |
| E2E `factory.spec.ts` | **Not run.** This container's Playwright browser binaries don't match the installed Playwright (webkit-2311 / headless-shell-1228 missing). |

## Checked and OK
- **Server authority:**
  - Every coin, stock change and job time is decided in SQL from `now()`.
  - Clients have SELECT only on `machines` and `production_jobs`. My probe confirmed that insert is refused (42501), and that update and delete affect 0 rows.
  - Anon gets 42501 on every factory RPC and reads nothing.
  - Another user's `collect_jobs` returns `n: 0`.
- **Races:** every mutating RPC takes `game_state … for update` first. Probes, fired with `Promise.all`:
  - `buy_machine` ×3 with coins for one: 1 ok, 2 × P0001, coins 0.
  - `start_job` ×4 with inputs for one job: 1 ok, stock 0, 1 job.
  - `start_job` ×5 with plenty of inputs and 1 job already queued: exactly 1 more ok (capacity 2 holds).
  - `collect_jobs` ×4 after both jobs were ready: one call gets `n: 2`, the others get `n: 0`. The inventory gains exactly 2 `product:pickles`.
  - `sell_produce('product:pickles', 2)` ×3 with 2 in stock: 1 ok, 2 × P0001, +68 coins.
  - `upgrade_machine` ×2 with coins for one: 1 ok, 1 × P0001.
- **No early collect and no negatives:**
  - `collect_jobs` only takes jobs with `ready_at <= now()`.
  - Coins change with `coins >= price` guards; inventory changes with `least(need, qty)` after a full stock check.
  - The `check (ready_at > start_at and start_at >= created_at)` constraint holds.
- **Queue:**
  - `start = greatest(now(), max(ready_at))` over all of the machine's jobs, collected ones included. It is computed under the lock, so jobs never overlap.
  - Capacity counts uncollected jobs, ready-but-uncollected included, and matches `hasRoom` / `full` in the UI.
  - Job minutes are frozen at start. A later speed upgrade doesn't touch queued jobs, so there is nothing to exploit.
- **Input matching:**
  - `crop:<id>` matches `item_id = key` or an exact `key || ':'` prefix. There is no LIKE, so `_` is not a wildcard. `crop:corn` doesn't match `crop:rainbow_corn…`, and `crop:strawberry` doesn't match `crop:snow_strawberry…`.
  - `produce:egg` is exact, so it never takes `golden_egg`.
  - Seeds, feed and products are never matched.
  - Order: lowest quality first, then the plain 2-part legacy key, then the cheapest weather.
  - TS `stockOf` mirrors this, and a unit test covers the `corn`/`cornx` prefix case.
- **`_sell_price` on products:** only `product:<known id>` with exactly 2 parts gets a price. `product:`, `product:pickles:x`, `product:pickles:gold:100`, `product:__proto__` and unknown ids all return null. There is no season multiplier (`_season_mult` returns 1 for non-crops). The stall bonus is applied. Integration parity with `sellPrice` holds for all 11 products at stall levels 0–2.
- **Economy loop:**
  - Inputs come only from habit-gated sources: crops grow on success-days, and animal goods come from exercise feeding.
  - Coins can't buy crops or produce directly. Seeds still need success-days, and tickets are capped at 2 a week.
  - Orders ask for crops, never products.
  - So the ~1.4× value-add is a reward rate, not a mint. Throughput is also bounded by machine time (best case pickles is about 100 coins/h per jam jar, if fed).
- **Market:**
  - `market_status`'s shelf now lists products, because its `_sell_price(...) is not null` filter is unchanged and products are now priced.
  - `deliver_order`, `deliver_seasonal_order` and `_orders` are untouched, and their crop patterns can't match `product:`.
  - The story `season_uses` parses `produce_sold` items, but `product:x` yields no seasonal month, so it is ignored.
- **Data:**
  - `machines` and `production_jobs` cascade from `auth.users`, and `production_jobs` also cascades from `machines` via the composite FK. I deleted a probe user who had 1 machine and 2 jobs: both went to 0.
  - Both tables are in `EXPORT_TABLES`, so they are in the RLS loops: A sees no B rows, and anon reads nothing.
- **Grants:** clients can't call `_stock_of(uid, key)` (a definer that takes an arbitrary uid) or `_sell_price` (probe: 42501).
- **KPI math:**
  - Utilization = busy overlap ÷ max(1 h, time owned in the window), capped at 1.
  - Throughput days = max(1, window ∩ since first machine).
  - Lead = ready − created (includes the queue wait); process = ready − start.
  - The window is `(now − 7 d, now]`, used the same way for "done" and for throughput.
  - Bottleneck = highest utilization, then most WIP, then catalog order (stable sort). It is null when nothing is busy or queued.
  - The hook loads the last 8 days plus every uncollected job, which covers the window.
- **R-M12-14 (`lib/share/compute.ts`):**
  - Sick and vacation days give no Free.
  - Sub-slots inside Free are cut. A clipped sub-slot (start = end = block end) cuts nothing.
  - The server action's `slotFits` uses the same function, so requests are checked against the new rule too.
  - `share_context` (service-role only since R-M12-1) still carries `mode`.
- **UI rules:**
  - No hardcoded EN/TH; only the "–" placeholder.
  - Buttons use `Button` (`min-h-11 min-w-11`). The entry, tabs and retry use `min-h-11`.
  - Tabs have `aria-pressed`. Queue bars have `role="progressbar"` with a label and values; utilization bars have `role="meter"`.
  - Errors use `role="alert"` and results `role="status"`. There are loading, load-error and retry states.
  - Double taps are guarded by a ref.
  - The puff is CSS and stopped by the global reduced-motion rule (`iteration-count: 1`).
  - The 1 s `useNow` tick runs only while the sheet is open, and it costs a few hundred array ops.
- **Art:**
  - Flat 2-tone shapes with the dark tone offset to the bottom-right (light from the top-left), and the flat `Shadow` ellipse only.
  - No gradients or filters, and no black.
  - Strokes are ≤ 1.5 px and are interior details (stems, crust line, knit zigzag, yarn tail), not outlines.
  - Only tokens are used.
- **Docs:** the ECONOMY.md factory table matches `content/factory.ts` and `_factory_catalog()`. The integration parity test covers machines, upgrade prices, recipes, minutes and prices.

## Findings

| ID | Sev | Where | Failure scenario | Fix |
|---|---|---|---|---|
| R-M13-1 | S3 | `supabase/migrations/20261114000000_factory.sql:107-112, 376-380` | **`factory_catalog()` is granted to `authenticated` but always fails.**<br><br>It is a plain `language sql` (invoker) wrapper around `_factory_catalog()`, and `_factory_catalog()` is revoked from clients. Probe as a signed-in user: `42501 permission denied for function _factory_catalog`; anon gets 42501 too.<br><br>ECONOMY.md lists it as a server function, and the header comment of `content/factory.ts` says the parity check uses it. The integration test calls `_factory_catalog` as service role, so it never noticed. Nothing in the app calls it today. | Either make it `security definer` (it returns static content only), or drop it and its grant and fix the two doc references.<br><br>Test: `expect((await u.client.rpc("factory_catalog")).error).toBeNull()`. |
| R-M13-2 | S3 | `components/farm/FactorySheet.tsx:254-277`; `lib/game/factory.ts:251` (`inputValue`, unused) | **"Make" silently uses quality or weather crops, and the make-or-sell choice is invisible.**<br><br>DECISIONS says "a gold or weather crop can be worth more sold as it is, so the player has a real make-or-sell choice". The sheet shows only "{have}/{qty}" (any quality summed) and "sells for N". It never shows which items will be taken or what they are worth. `inputValue` is documented "for the make-or-sell hint" but is unused.<br><br>Scenario: she has 1 normal radish, 1 prismatic ×4-weather radish (sells for 48) and 2 turnips. One tap on Make Pickles consumes the 48-coin radish into a 34-coin product. There is no cancel. | Mirror the SQL take order in a pure `takePlan(recipe, stock)` (quality rank, then 2-part key, then `sellPrice`, then id), with a unit test against the integration case. When the plan takes anything above normal or with weather > 1, show a line such as "Uses your gold radish (sells for 9)", and make Make a two-tap confirm in that case only. Optionally show "ingredients ≈ 24 → 34" from `inputValue`. |
| R-M13-3 | S3 | `FactorySheet.tsx:191-206` (toast `n: ready`); `useFactory.ts:85-90` | **The Collect toast trusts the device clock, not the server.**<br><br>The message is `collected {n: ready}`, where `ready` is counted from `Date.now()`. The server's `n` is returned, but the code only checks it for `null`.<br><br>If a phone clock runs fast (or a job's `ready_at` is seconds away), the user taps "Collect 1", the server collects 0, and the sheet says "Collected 1. Sell them at the market." Nothing is in the shelf, and the job still shows "Ready".<br><br>The countdowns and the Ready state also use the device clock against server timestamps. | Use the returned `n`. For `n === 0`, show a "not quite ready, a few seconds more" line and reload. Optionally keep a server-clock offset (from the `start_job` response's `start_at` vs the local time of the call) and use it in `useNow`. |
| R-M13-4 | S3 (G3 R3) | `components/art/farm/Factory.tsx:33-50` vs `:166` (`Jar` with `lid="gingham"`) | **The jam jar machine and the strawberry jam product are nearly the same drawing:** a glass jar, red jam fill, a red gingham lid with two white stripes. The machine just sits on a thin wooden stand.<br><br>They appear together:<br>- the queue row (product at 32 px under the 56 px machine)<br>- the KPI list (machine at 32 px)<br>- the Farm entry row (jam jar = "Factory")<br><br>The rubric auto-fails R3 when two items are confusable at 48 px.<br><br>Also check butter (a yellow rounded block on a white plate) vs cornbread (a yellow rounded block) at the 32 px queue size. | Make the machine read as equipment: for example a copper jam pot on a small burner, or a big jar with a funnel and press lever. Or give the product a different silhouette (a squat jar with a plain lid and a label). Re-shoot `/dev/art` at 48 px and 32 px. |
| R-M13-5 | S3 | tests | **Test gaps.** Each of these is fine today (my probes or arithmetic), but nothing keeps it so:<br>(a) No SQL/TS parity check for the half-minute cases: strawberry jam, butter and yarn at speed 2 (19.5 → 20), pumpkin pie (58.5 → 59). The integration test only checks cheese (39).<br>(b) No concurrency test for `start_job` / `collect_jobs` / sell (CJ-12-style double tap).<br>(c) No test that a speed upgrade leaves queued jobs' times alone and that the next job queues after them.<br>(d) No test of `factory_catalog()` as a user (it would have caught R-M13-1).<br>(e) The E2E is one happy path in EN only. It doesn't cover the "machine is full" message, upgrade buttons, the load-error/retry state or TH layout at 375 px. | Add:<br>- (a) An integration loop over every recipe × speed level comparing `mins(job)` with `jobMinutes`. Use a capacity-4 machine and reset between levels, or compute `round` in SQL via a `select`.<br>- (b) `Promise.all` probes like the ones in this report.<br>- (c) and (d) small integration cases.<br>- (e) An `iphone-small` TH pass of the sheet with `expectNoHorizontalScroll`. |
| R-M13-6 | S4 | `FarmScreen.tsx:383` | **The reveal hides the factory from some players and causes a layout shift.**<br>- A player with animal goods but no crop row never sees the factory, although the cheese press and loom need only milk and wool.<br>- `?? true` shows the row while gacha loads and then removes it for a brand-new farm. The locked-fields row has the same shift. | Reveal on "has any crop or produce row". Render nothing until `gacha.state` is known. |
| R-M13-7 | S4 | `FactorySheet.tsx:240-245, 267, 300` | **Queue and level labels are unclear.**<br>- A waiting job shows only "Waiting", with no start or ready time.<br>- After a speed upgrade, the recipe line shows the new minutes, but queued jobs keep the old ones.<br>- The level labels start at "Speed Lv 0" / "Space Lv 0". | Show "starts in N min" for waiting jobs. Add "new jobs only" to the upgrade toast. Consider showing levels from 1. |
| R-M13-8 | S4 | `FactorySheet.tsx:58-67`, `useFactory.ts:66-75` | **For one round-trip after an action, buttons act on stale data.**<br><br>`pending` clears when the RPC returns, but the reload is still in flight. For that moment, Make is enabled on the old stock and queue. A quick second tap gets the server's "Not enough ingredients" or "machine is full". This is harmless (the server decides). | Await the reload before clearing `pending`: have `reload` return the load promise. |
| R-M13-9 | S4 | `20261113100000_seasonal.sql` `deliver_seasonal_order` (outside the diff) | **An older function still uses the LIKE pattern the new code avoids.** It matches with `like 'crop:' \|\| crop \|\| ':%'`, which the new `_stock_of` comment warns against (`_` is a wildcard). No current crop ids collide (`candle_lotus`, `snow_strawberry`). | Switch to the `left(...)` prefix form the next time that function is touched. |

**Note (not a finding):** the local database's `schema_migrations` stops at `20261112010000`. The later migrations, including this one, were applied by hand as `supabase_admin`, so locally the factory objects are owned by `supabase_admin` instead of `postgres`. CI's `supabase start` applies every migration fresh as `postgres`, which covers this. Just don't treat the local run as proof that `db push` works.

## Verdict
**PASS.** There are no S1/S2 findings. The server owns every coin, item and timestamp. Locking, capacity, the input matching and the `_sell_price` / deny-list changes hold up under live race probes. R-M13-1…5 are S3: fix them or log them as known issues in `docs/qa/M13-report.md`. R-M13-2 (silent use of quality crops) and R-M13-4 (confusable jam art) are the ones Minnie is most likely to notice. Run the factory E2E on the WebKit projects before merging; it was not run here.
