# QC report: M13 — factory (PR #21)

| Gate | Result | Evidence |
|---|---|---|
| G1 Static | ✅ | `npm run qc:static`: typecheck, lint, Prettier, i18n (EN = TH), art lint (machines + products: tokens only, no black, strokes ≤ 1.5 same-hue); secrets check clean |
| G2 Functional | ✅ | **Unit**: factory content (the price ratio stays within 1.3–1.7×), queue rules, job states, inputs at any quality, the server's take order + premium warning, KPI maths (window, a 1 h minimum denominator, lead vs work, bottleneck); share-compute (R-M12-14).<br>**Integration**: the catalog matches between SQL and content; build/upgrade costs and limits; lowest-quality-first inputs; the queue behind the last job; capacity; collect only when ready; sell; speed doesn't touch queued jobs; `factory_catalog` for a user; no client writes; other users see nothing.<br>**E2E**: CJ-FAC-1 (build → make → time → collect → Numbers → sell) and CJ-FAC-2 (premium warning) on Chrome locally; iPhone/WebKit in CI. |
| G3 Visual | ✅ (390 px) / ⏳ Mac baselines | Factory row, both tabs and the warning were checked at 390 px in TH and EN. The jam-jar machine now differs from the jam product (G7 R-M13-4). |
| G4 UX | ✅ | Touch targets ≥ 44 px. Labelled buttons. `progressbar`/`meter` roles. `aria-pressed` tabs. Errors and loading/retry states. The puff animation stops under reduced motion. Plain words in the KPI panel. |
| G5 Data & security | ✅ | RLS is forced on `machines` and `production_jobs` (own select only, no client writes). Every change is a `security definer` RPC with `search_path=''` on the server clock, serialised by the `game_state` row lock. G7 race probes: concurrent buy/start/collect/sell/upgrade each succeed exactly once. Inputs match on an exact prefix, not LIKE. The events deny-list is an exact superset. Account deletion cascades. |
| G6 Production | ⏳ | After merge: `db push --remote` (share + factory), then `npm run qc:prod` |
| G7 Independent review | ✅ PASS (round 1, no S1/S2) | `docs/qa/M13-review.md`. Fixed after: R-M13-1 (`factory_catalog` security definer, test-first), R-M13-2 (premium crop asks first, test-first), R-M13-3 (the server's collected count), R-M13-4 (machine art), R-M13-5 (new tests), R-M13-6 (reveal also with animals; no flash on a new farm), Lv labels from 1 (R-M13-7, part) |

Known issues (S3/S4, deferred):
- **R-M13-7 (rest):** waiting jobs show no start time, and a speed upgrade doesn't explain that it only affects new jobs.
- **R-M13-8:** buttons are briefly enabled on stale data; the server refuses.
- **R-M13-9:** `deliver_seasonal_order` still uses LIKE; no crop ids collide today.
- **R-M13-5 (rest):** there's no E2E of the Thai or dark-mode sheet.

Deferred features:
- café brewing from produce;
- the mooncake recipe (needs the Moon Lotus crop);
- orders for products.
