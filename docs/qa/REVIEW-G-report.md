# QC report: Big buys ask first + Farm yard (Phase G)

| Gate | Result | Evidence |
|---|---|---|
| G1 Static | ✅ | Typecheck, lint, Prettier, i18n (1339 keys EN/TH) |
| G2 Functional | ✅ | Vitest 115 files / 764 tests (unit + integration, incl. yard moves/swaps/refusals, festival set, parallel decor inserts); local E2E Chromium 162 passed / 1 skipped / 0 failed (new `yard.spec`, Shop/Factory/Seasonal confirm flows) |
| G3 Visual | ⏳ | New art (butterfly, bird) follows the art rules (tokens, no outlines, no black). Mac visual baselines need re-recording after merge (Today header from #31, yard, Shop) |
| G4 UX | ✅ | Every yard action is a tap with "Move to…" (no drag needed); touch targets ≥ 44 px; axe sweep in `shell.spec` passes EN/TH light/dark; visitors still under reduced motion and Skip animations; Escape closes only the top sheet |
| G5 Data & security | ✅ | `place_decor` / `store_decor` are `security definer`, `search_path=''`, check `auth.uid()` and owner, spots 1–8; users can't write `spot` (column grant); new decor gets its spot under a per-user advisory lock; festival beat is server-checked, no gift |
| G6 Production | ⏳ | Before merge: Minnie runs `db push --remote` (`20261124000000_farm_yard.sql`). After merge: `npm run qc:prod` |
| G7 Independent review | ✅ PASS | `docs/qa/REVIEW-G-review.md`: no S1/S2. Fixed: S3-1 (race, test-first), S3-2 + S4-2 (Som placement, no tap capture), S3-3 (Escape closes the top sheet only, focus returns), S3-4 (Farm tab still loads before `db push`: decor select falls back), S4-3 (spots 7/8 raised), S4-4 (storage tray above the night veil), S4-6 (machine upgrade wording), S4-7 (plan doc; `store_decor` no-op on stored items) |

Deferred:
- S4-1: the festival integration test only reaches the claim in months that have a festival item; the other months check "not yet". Accepted (a fake clock would need a server-side day override).
- S4-5: no notice when a buy goes to storage because the yard is full. The tray shows it; a toast can come with yard drag.
- Drag-and-drop in the yard (DECISIONS 2026-11-23).
