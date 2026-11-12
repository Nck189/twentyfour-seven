# QC report: Story with Som + seasonal crops (Candle Lotus) + chibi animals (PR #16)

| Gate | Result | Evidence |
|---|---|---|
| G1 Static | ✅ | `npm run qc:static`: typecheck, lint (0 warnings), Prettier, i18n (927 keys EN/TH), art lint |
| G2 Functional | ✅ | Unit 330, integration 234 (story, seasonal, parity, RLS loops); local E2E Chromium 105 passed / 4 time-skips / 0 failed; CI runs the WebKit matrix |
| G3 Visual | ✅ (art) / ⏳ Mac baselines | Animals: 5 QC rounds with Minnie and an independent art reviewer, checked on white and dark pen tiles at 220/96/48 px. Farm/Thai Mac baselines still need re-recording once (known since R1) |
| G4 UX | ✅ | axe 0 serious on new screens (story, settings, Shop); touch targets ≥ 44 px; scenes skippable, still with reduced motion, Escape closes |
| G5 Data & security | ✅ | New RPCs are `security definer` with `search_path=''` and auth.uid(); parallel claims/deliveries/wishes pay once; `season_clock` is service-role only; wishes are own-row and never written into events; new tables exported and in the RLS loops |
| G6 Production | ⏳ | After merge: Minnie runs `db push --remote` (3 migrations) and `npm run qc:prod` |
| G7 Independent review | ✅ PASS (re-review at 32fb795) | `docs/qa/STORY-review.md`: 3 S2 (R1, R2, R3) fixed test-first; S3 R4/R5/R9 fixed; R6/R8 deferred to M11; R7 needs Minnie. The re-review's new R22 (S3, a replayed wish scene after a floated wish) and R24 (S4, more exam false positives) are fixed test-first too |

Deferred: capsule drop for seasonal seeds, December's beats, the wish-return scene next year, beats right after Goodnight, R6/R8 (M11). See `docs/DECISIONS.md`.
