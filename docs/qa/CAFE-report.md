# QC report: Snow Strawberry beats, story chapters 3–6 + R, Som's café, coffee/tea & bedtime insight, block clock (PR #17)

| Gate | Result | Evidence |
|---|---|---|
| G1 Static | ✅ | `npm run qc:static`: typecheck, lint (0 warnings), Prettier, i18n (1017 keys EN/TH), art lint (the mug handle stroke caught by CI, fixed as a filled shape) |
| G2 Functional | ✅ | Unit 348; integration 246+ (cafe, story, snow-story, seasonal-story, RLS loops, export list); local E2E Chromium 113 passed / 2 skipped / 0 failed, including CJ-CAFE-1..4, CJ-SEASON-3; CI runs the WebKit matrix |
| G3 Visual | ✅ (art) / ⏳ Mac baselines | Cups ×8, café table, farm sign, five new story scenes and the Welcome back card checked at 390 px and 48 px; no black, tokens only, strokes ≤ 1.5. Farm/Thai Mac baselines still need re-recording once (known) |
| G4 UX | ✅ | axe 0 serious on the café sheet, Night ritual step 4, Stats → Sleep; touch targets ≥ 44 px; no horizontal scroll at 390 px; honest saved/failed states (no "Noted" before the server has it) |
| G5 Data & security | ✅ | New RPCs are `security definer`, `search_path=''`, `auth.uid()`; clients can't write orders, answers, schedule or decor; café cards never mint currency; ch6 counts only live days since sign-up; parallel orders/claims grant decor once (probed); café/story events server-only; new tables exported and in the RLS loops |
| G6 Production | ⏳ | After merge: Minnie runs `npx supabase db push --remote` (3 migrations: snow_story, cafe, story_chapters) and `npm run qc:prod` |
| G7 Independent review | ✅ PASS (round 3 at 3e22e23) | `docs/qa/CAFE-review.md`: round 1 FAIL (S1 R-C1 coin faucet; S2 R-C2..R-C5) → fixed; round 2 FAIL (S1 R2-1 ch6 via backfills) → fixed test-first; round 3 PASS. Open: S3 R2-5 (story tickets outside the ticket ledger, pre-existing pattern), S4s accepted |

Deferred: Som's barista outfit (wardrobe), brewing from produce (M13), a shared ticket ledger for story gifts. See `docs/DECISIONS.md`.
