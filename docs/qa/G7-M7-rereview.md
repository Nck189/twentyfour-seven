# G7 re-review — M7

**Range:** `52faa3a..ab4baa1` on `m7-local` (fix commit `ab4baa1`). Read-only review: `git status` was clean before and after.

## Verdict: FAIL — 0 × S1, 1 × S2, 0 × S3, 6 × S4 open

The fix commit closes R-M7-1 and R-M7-3 through R-M7-7, R-M7-11 and R-M7-12. Each fix is real, and the new unit tests fail on the pre-fix code. I checked that by running the new tests against `ab4baa1^` in a scratch copy.

R-M7-2 (CJ-12 E2E) is only **partially** fixed. The new `CJ-12b` has two problems:
- It is **non-deterministic**: about 12 % of runs fail per project, which comes to about 54 % of local 6-project runs.
- Its **double-tap check can't fail**, because the user has only 1 ticket.

As a result, G2's "100 % pass" can't be met reliably, and CJ-12's bold requirement ("double-tap doesn't double-spend") is still effectively untested. This is tracked as R-M7-R1 (S2).

## First-review findings

| ID | Sev | Status | Evidence |
|---|---|---|---|
| R-M7-1 | S2 | **Fixed** | The `show()` guard (`shown` ref) clears the timers. The crack timer no-ops once the results are shown, and the jingle plays once. `tests/unit/reveal.test.tsx` passes on HEAD. On the old code, with the jingle asserts removed, it fails with "Unable to find … Done" after an 800 ms advance, so it proves the rewind. |
| R-M7-2 | S2 | **Partially fixed** → R-M7-R1 | `gacha.spec.ts` lists 24 tests (4 × 6 projects). I checked every selector against the components and `messages/en.json`:<br>• sheet dialog "Capsule machine", reveal dialog "Your capsules", "Pull ×1/×10", "0 tickets" plural, `howToEarn`, "Rare+ in {n}", Close, `/^Seed-dex/`, "1 of 20 found · 5%" — all OK.<br>• The TH visual selectors `/^ตู้/`, `/^สมุดเมล็ด/` and "ปิด" match `th.json`.<br>But CJ-12b is flaky and its double-tap assert is vacuous (see R-M7-R1). |
| R-M7-3 | S3 | **Fixed** | Repeat now returns `events.payload->'results'` for the exact key. On scratch PG16:<br>• A ×10 with `key-aaaa-1`, then other pulls (`key-bbbb-2`, `key-aaaa-1:9`, and a ×10 `key-aaaa-1:1`), then a retry of `key-aaaa-1`: results are identical, NEW/shards included, and nothing is charged.<br>• A concurrent same-key call (first session held open with `pg_sleep(3)`): the second session returned `repeat:true` with the identical card, charged once.<br>The integration test now asserts `toEqual` on the full payload. |
| R-M7-4 | S3 | **Fixed** | `busyRef` + `busy` on Star up. `seeddex.test.tsx` passes, and on the old code it fails (2 calls). |
| R-M7-5 | S3 | **Fixed** (S4 remainder → R-M7-R4) | `SetupRewardNotice` is on Today and More, shows `rewardTitle` plus reward labels, has a 44 px OK button, and keys exist in EN/TH (i18n check: 516 keys). The Home Screen reward is still silent (R-M7-R4). |
| R-M7-6 | S3 | **Fixed** | `coin_grants`, `unlock_grants` and `wake_snapshots` were added with unique orders (each matches its PK). All 3 have `user_id`, so the RLS loops work.<br>• `export-tables.test.ts` fails on the old code (16 vs 19 tables) and passes now.<br>• `data.spec.ts` now compares keys with `EXPORT_TABLES`.<br>• `fetchAll` and the CSV zip are generic, so they need no change. |
| R-M7-7 | S3 | **Mostly fixed** (S4 remainder → R-M7-R3) | The reveal now has:<br>• `role="dialog"`, `aria-modal`, and `aria-label` "Your capsules";<br>• focus on Skip, then Done (unit-tested);<br>• a `role="status"` region that exists before it fills.<br>Still missing: Tab isn't contained, and focus isn't restored after Done. |
| R-M7-11 | S4 | **Fixed** | Exact `p_key || ':1'` existence check plus an exact payload key match. `key-aaaa-1:9` and `key-aaaa-1:1` were new pulls (`repeat:false`). |
| R-M7-12 | S4 | **Fixed** | `has_table_privilege(authenticated, unlock_grants, …)`: truncate f, select t, insert f; anon select f. |
| R-M7-8, -9, -10, -13, -14 | S4 | Not addressed (log-only) | Still open as S4. |

Forgery check for the events-based lookup: the client can't insert a `gacha_pull` event (RLS deny-list, verified). Events have no update/delete policy (0 rows affected). The lookup only runs when a real `gacha_pulls` row `<key>:1` exists. So a client can't change a repeat's results.

## New findings

| ID | Sev | Where | Repro | Fix |
|---|---|---|---|---|
| R-M7-R1 | **S2** | `tests/e2e/gacha.spec.ts:34-55` (CJ-12b) | **(a) Flaky.** After a single ×1 from fresh pity, the test asserts `"Rare+ in 9"`. If the pull is rare or better (P = 0.005 + 0.025 + 0.09 = 12 %; SQL sim of 100k first pulls gave `since_rare = 0` 11.9 %), `since_rare = 0` and the sheet correctly shows "Rare+ in 10", so the test fails. With 6 projects and no retries locally (the Mac `npm run e2e`), about 54 % of full runs go red. With CI `retries: 1`, about 8 % do. G2 needs 100 %.<br>**(b) Vacuous double-tap.** With `tickets = 1`, a second pull would be refused server-side (P0001) whatever the client does. So `pulls = 1` / `tickets = 0` pass even without the client guard, and the test doesn't assert that no error alert appeared. CJ-12 "double-tap doesn't double-spend" is not proven. | (a) Read `gameState(id)` after the pull and assert `` `Rare+ in ${10 - g.pity.since_rare}` `` (as CJ-12c does).<br>(b) Seed ≥ 2 tickets for the double-tap, then assert 1 `gacha_pulls` row, `tickets = n - 1`, and `role=alert` count 0.<br>Optionally prove the test by temporarily removing `busy` and checking that it goes red. |
| R-M7-R2 | S4 | `pull_gacha` repeat branch (`20261103070000_m7_gacha.sql:105-111`) + `Reveal` | If `gacha_pulls` has `<key>:1` but no keyed event (only possible for pulls made by a pre-`ab4baa1` build of this migration on a DB that already applied it), the repeat returns `results: []`. `Reveal` then hits `top = undefined` → `[top].map(r => r.rarity)` in the crack phase and the component crashes. It can't happen on a fresh DB: the event is written in the same transaction. Note that the migration was edited in place, so any local stack that already applied it keeps the old function until `supabase db reset`. | Client: treat empty `results` as an error (`out?.length ? … : setError`). Optionally, in SQL, fall back to rebuilding from `gacha_pulls` when no event is found. |
| R-M7-R3 | S4 | `components/farm/CapsuleSheet.tsx` Reveal | Tab from Skip/Done leaves the overlay and reaches farm controls under it, because `aria-modal` doesn't trap Tab and the Sheet has no trap either (that part predates M7). After Done, the focused button unmounts and focus falls to `<body>`. | Trap Tab inside the reveal (or `inert` the rest), and return focus to the Pull button / the sheet's Close on Done. |
| R-M7-R4 | S4 | `components/providers/ProfileSync.tsx` → `reportHomeScreenOnce` | The Home Screen decor reward is granted by `report_home_screen`, and its `granted` result is discarded. Later `claim_setup_rewards` calls don't report it as newly granted, so this reward never shows the new notice. | Surface `granted` from `report_home_screen` through the same notice (e.g., a store flag), or show it on the next Today visit. |
| R-M7-R5 | S4 | `useSetupRewards` (Today/More) | If the user leaves Today before the claim response arrives, the reward is paid but the response is discarded (`cancelled`). The next screen's claim returns `granted: []`, so that notice is lost. This is a rare edge case. | Acceptable, or have the notice read from the `unlock_granted` events newer than a locally stored "last seen". |
| R-M7-R6 | S4 | `tests/e2e/gacha.spec.ts:79` (CJ-12d) | The title says "silhouettes", but nothing asserts them (e.g., 19 × `img` "Not found yet"). | Add `expect(dex.getByRole("img", { name: "Not found yet" })).toHaveCount(19)`. |

## What I ran

- **Unit tests.** `npx vitest run tests/unit`: 25 files, 214 tests passed. The 3 new test files fail on the `ab4baa1^` code (scratch copy) with the expected messages.
- **Static checks.** `npx tsc --noEmit` shows only the known `LayoutProps` errors. `eslint --max-warnings 0` on the changed files is clean. `scripts/i18n-check.ts` → 516 keys in EN/TH.
- **Playwright list.** `npx playwright test --list tests/e2e/gacha.spec.ts` → 24 tests (iphone, iphone-small, ipad-portrait, ipad-landscape, mac, chrome-desktop).
- **Scratch PG16** (all 16 migrations applied cleanly):
  - Exact repeat after interleaved pulls and prefix keys.
  - Concurrent same-key call.
  - Forging, updating and deleting a `gacha_pull` event (refused / 0 rows).
  - User B reusing A's key (a new pull for B, with none of A's data).
  - `unlock_grants` privileges.
  - First-pull rarity distribution (100k).
- **Not run:** the integration and E2E suites (no Supabase stack here). For those I checked selectors and reasoned through the logic.
