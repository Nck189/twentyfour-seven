# QC report: review fix Phase A — every share leads back, new app icon

Plan: `docs/REVIEW_FIX_PLAN.md` Phase A (A1–A5), plus the app icon Minnie asked for on 2026-11-16.

| Gate | Result | Evidence |
|---|---|---|
| G1 Static | ✅ | typecheck, lint, Prettier, i18n (1246 keys, EN = TH), art lint (22 files, 74 tokens; the icon's gradient lives in a sky component) |
| G2 Functional | ✅ Chrome locally / ⏳ WebKit in CI | Unit + integration 706 (two integration tests failed once right after the local database started and passed on a re-run). New unit tests: public address, QR matrix and sizing, the farm snapshot, the picture layout, font fitting, unique icon ids. E2E on Chrome: 132 passed, 3 skipped. New or extended: the visitor page's invite (CJ-SHARE-1), an empty week offers no picture, the hatch reveal's Share + download (CJ-13), link-preview tags and icon files (`brand.spec`). |
| G3 Visual | ✅ looked at / ⏳ Mac baselines | Real pictures drawn and viewed: week (TH dark, EN light), hatch, free times. QR codes decoded from the PNGs: week and moment → the app, free times → her share link. Icon viewed at 180 and 60 px next to the old one; maskable and link-preview PNGs viewed. **Baselines in `tests/visual` still show the old mark** (login, 404, iPad/Mac nav): re-shoot on the Mac with `npm run e2e:update`. |
| G4 UX | ✅ | Share sits under Done and never blocks it. Buttons ≥ 44 px. A picture that can't be drawn hides its button (or says so on the week card). The free-times card says when the picture carries her link. |
| G5 Data & security | ✅ | Pictures hold crop ids, species, a house level and numbers only; no tasks, names, times or email (G7 checked). The share-link token is only on the free-times picture she chooses to send. `share_made {kind}` passes the events policy. `/share/[token]` stays noindex with a generic title and preview. |
| G6 Production | ⏳ | After merge: `npm run qc:prod`; paste a link in LINE to see the preview; scan a picture's QR with a phone. No migration. |
| G7 Independent review | ✅ PASS (round 1, no S1/S2) | `docs/qa/REVIEW-A-review.md`. Fixed after: R-A-1 (QR: whole-pixel modules ≥ 3 px, 4-module margin), R-A-2 (the card says the picture has her link), R-A-3 (unique SVG ids per icon), R-A-4 (a long line gets a smaller font, never squeezed), R-A-5 (no dead button), R-A-6 (icon on `/dev/art`), R-A-10 (lockfile restored, one dependency added), R-A-11 (two pieces centred), R-A-12 (no nested landmark), R-A-13 (Thai wording). |

Known issues (S3/S4, deferred):
- **R-A-6 (rest):** the Mac visual baselines (above).
- **R-A-7:** `share_made` is logged on the tap, not on a finished share.
- **R-A-8:** `?from=` isn't recorded yet (needs the front door, Phase B).
- **R-A-9:** the link-preview text uses a system font; the build script can't reach the web fonts.
- **R-A-12 (rest):** "Picture ready." inside the streak notice may be read twice by a screen reader.
- **R-A-14:** no automated WebKit check of the share sheet; pictures aren't pixel-tested.
- **Decision for Minnie (R-A-2):** the free-times picture carries her link by default. Say if it should be a switch instead.
- **Real-phone checks not done here:** the iOS share sheet, and scanning a picture after LINE has re-compressed it.
