# QC report: review fix Phase F part 1 — sound, small animations, farm ambience

Plan: `docs/REVIEW_FIX_PLAN.md` Phase F, items F1–F3. No migration.

| Gate | Result | Evidence |
|---|---|---|
| G1 Static | ✅ | typecheck, lint, Prettier, i18n (1296 keys, EN = TH) |
| G2 Functional | ✅ Chrome locally / ⏳ WebKit in CI | Unit + integration 736, plus the sound tests below. Full Chrome E2E on the first commit: 159 passed, 1 skipped. After the review fixes, the farm, animals, shop, factory, café, Today, strip, streak and rewards specs: 35 passed. New unit tests: every new sound is in C major, ≤ 1 s and soft; the sound map lists every `sfx` sound and every mapped sound is called; every sound is silent when muted, in a quiet block (except the user's own timer), or while audio isn't running yet; growth detection (first visit, same planting, replant, broken saved value); the ambience (kind by sky, very soft, spaced out). New E2E (`rewards.spec`): a crop that grew steps up once and not again; with reduced motion it's in place at once; finishing a block bounces its plot on the Today strip. |
| G3 Visual | ✅ looked at | The step-up, the strip bounce, the coin fly and the petals in Chrome. No baseline change: every animation ends at the resting state. |
| G4 UX | ✅ | All animations are ≤ 600 ms, transform and opacity only, never block a tap, and are skipped with "Skip animations" and stopped by reduced motion. The farm ambience is off by default and has its own switch (EN + TH). |
| G5 Data & security | ✅ | No server change. The only new storage is the last farm stages shown, in localStorage, per account. |
| G6 Production | ⏳ | After merge: `npm run qc:prod`. On the phone, with sound on: start and finish a block, plant, buy, and turn on Farm sounds on the Farm tab. |
| G7 Independent review | ✅ PASS (round 1, no S1/S2) | `docs/qa/REVIEW-F1-review.md`. Fixed after: F-1 (sounds are dropped, not piled up, while audio isn't running; it resumes from "interrupted" too), F-2 (a failed pet shows an error, not "that's enough"), F-3 (buying decor plays the buy sound), F-4 (silence tests with a stubbed AudioContext; the ambience goes through the same mute and quiet checks), F-5 (grown crops remembered per account, merged on write, nothing remembered for a preview), F-6 (the step-up doesn't hold its transform afterwards), F-7 (coins 0.54 s, petals 0.57 s), F-8 (three notes only when every current item is ticked, by id), F-11 (ambience in the sound map; `playNotes` guarded). |

Known issues (S4, deferred):
- **F-9:** the error note can play on opening the app when failed saves are restored, and again if the automatic retry fails.
- **F-10:** the sound-map test checks per sound, not per moment. It can't see the Shop's `sfx[sound]()` choice (covered by `shopSound`'s own unit test instead).
- **F-11 (rest):** the ambience follows the sky at farm load; birds can play past dusk until the farm reloads.
- **F-12:** finishing a block before the strip loads makes it bounce when it arrives. Som bounces rather than looking up (a "look up" pose is Phase F4 art).
- **F-13:** the reduced-motion E2E checks the resting transform, not the animation's duration.
- **Not from this phase:** no "rain" ambience, because the weather set has no rain (DECISIONS).
