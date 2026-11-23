# QC report: review fix Phase F part 2 — Som follows the block, milestone scenes

Plan: `docs/REVIEW_FIX_PLAN.md` Phase F, item F4 (Som in Today's header only) and F5. **One migration:** `20261123000000_milestone_beats.sql`.

| Gate | Result | Evidence |
|---|---|---|
| G1 Static | ✅ | typecheck, lint, Prettier, i18n (1312 keys, EN = TH), art lint |
| G2 Functional | ✅ Chrome locally / ⏳ WebKit in CI | Unit + integration 748. Full Chrome E2E before the review fixes: 160 passed, 1 skipped. After them, the story, farm-strip and Today specs: 12 + 21 passed. New tests: <br>• `markFor` maps each block to its sky. <br>• Each milestone scene is refused before its milestone (checked by message), granted once, refused after ("already seen"), and pays nothing. <br>• Welcome back counts only within the last 7 days and plays before other queued scenes. <br>• E2E: the perfect-day scene plays once and Skip closes it, in any month. <br>• E2E: the header mark follows the block, and the header fits 390 px in EN and TH. |
| G3 Visual | ✅ looked at | The four skies in `/dev/art` (dusk added); Today's header at 390 px. |
| G4 UX | ✅ | Scenes are three panels each, skippable, and shown once. They never play over a busy moment and pay nothing extra. Welcome back is kind and never guilty, and plays the day it happens. The mark is decorative (`aria-hidden`). |
| G5 Data & security | ✅ | The migration redefines `_story_facts` and `_story_ready` exactly as before, plus the new facts and beats. Both stay security definer with an empty search_path, and only the server roles can run them. Users can't write the new facts' sources: `jobs_collected` events are blocked by the events insert policy, and `ticket_grants` and `day_results` are select-only. |
| G6 Production | ⏳ | **Before merge:** Minnie runs `npx supabase db push --remote` from this branch. After merge: `npm run qc:prod`. |
| G7 Independent review | ✅ PASS (round 1, no S1/S2) | `docs/qa/REVIEW-F2-review.md`. Fixed after: <br>• S3-1: the perfect-day lines are in the past tense and match the rule. <br>• S3-2: welcome back needs one in the last 7 days and plays first (test first). <br>• S3-3: the Thai lines use คุณ like every other scene. <br>• S3-4: dusk is in the art gallery; E2E for the mark and the 390 px header. <br>• S4-1: the dusk sun is pink-light, so Som's orange fur stands out. <br>• S4-2: the 30-day scene is "A month of mornings", no longer the same title as the 30-days-used scene. <br>• S4-3: refusals are checked by message. <br>• S4-4: the "made" fact's comment says what it counts. |

Known issues (deferred):
- **F4 pictures on text-only screens** (empty states, the Night ritual and weekly review headers, the setup steps, offline and error pages) are the next PR.
- **No browser-tab icon change:** the favicon is rendered on the server, which doesn't know the user's current block.
