# QC report — Economy v2 (PR #15)

**Scope:** `docs/ECONOMY.md` (Minnie OK 2026-11-11). It covers:
- harvest value judged by the server;
- the market, the seed shop and the ticket swap;
- tiered upgrades, daily orders and the reward jar;
- the farmhouse art;
- the first-10 "fertilizer" feedback.

## Gates
| Gate | Status |
|---|---|
| G1 Static | ✅ typecheck, eslint (0 warnings), prettier, i18n (EN/TH), art lint |
| G2 Unit + integration | ✅ 66 files, 500 tests. Includes the harvest parity test (40 random weeks: SQL = `simulatePlot`), SQL prices = TS prices for every crop × quality × weather × stall level, the sell-vs-deliver race, and quality-first delivery. |
| G2/G4 E2E | ✅ locally on Chromium (shop journey, harvest → shelf, first-10 line, decor in the Shop tab). CI runs the WebKit matrix. |
| G3 Visual | ⚠️ The Farm screen changed (Shop instead of the decor shelf), so the Mac baselines need re-recording once. |
| G5 Secrets | ✅ CI |
| G6 Prod | After merge: `db push` (2 migrations), then `npm run qc:prod`. |
| G7 Independent review | ✅ First review FAIL (1 S1, 4 S2); all fixed; re-review PASS at c03890a (`docs/qa/ECON-review.md`). |

## G7 findings and fixes
| ID | Sev | Finding | Fix |
|---|---|---|---|
| E1 | S1 | One stock could be paid twice (sell racing deliver, or two orders) | Every stock change locks the user's row first; an order raises unless every unit was taken |
| E2 | S2 | The shelf and orders stayed stale after a harvest or collecting produce | A wallet-changed signal reloads the Shop; switching tabs reloads too |
| E3 | S2 | The coin count stayed stale after buying decor, and refusals said "check your connection" | Same signal; refusals now say what happened |
| E4 | S2 | Long Thai reward titles were squeezed | Two-line rows |
| E5 | S2 | No visible payoff after an action, and house level 3 ≈ level 2 | A payoff line with a coin pop and sound; level 3 is wider, with an attic window and porch posts |
| E6 | S3 | Orders took the lowest value first instead of the lowest quality | Lowest quality first |

S3s fixed after the re-review:
- N1: the payoff line sticks to the top of the screen.
- N2: "Cancel" sits where "Redeem" was, so a double-tap can't spend.
- N3: the refusal text covers every reason.
- N4: order rows show the coins once, and the Thai copy reads more naturally.

## Known issues (deferred)
- The fertilizer line also shows when the block's plot is empty (S3).
- Orders can change crop mid-day (S3).
- Long-term players get orders for rare crops they can't fill (S3).
- **Long-term coin sinks:** upgrades are bought out in about 4–6 weeks, after which tickets and decor remain. M13 (machines, recipes) and M14 (treats, themes, seasonal sets) are the planned sinks.
- **N5:** the E1 fix edited `20261112010000_market.sql` in place. That is safe because it has never run outside local.
