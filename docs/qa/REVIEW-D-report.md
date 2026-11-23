# QC report: review fix Phase D — More in four groups

Plan: `docs/REVIEW_FIX_PLAN.md` Phase D. No migration.

| Gate | Result | Evidence |
|---|---|---|
| G1 Static | ✅ | typecheck, lint, Prettier, i18n (EN = TH) |
| G2 Functional | ✅ Chrome locally / ⏳ WebKit in CI | Unit + integration 724 (new: the card → page mapping, every old anchor, broken escapes never throw, setup links point at their card's page). E2E on Chrome: 155 passed, 2 skipped. New `more.spec`: four rows, each page shows its cards, Back returns to More, a11y/touch/no horizontal scroll on every page; every old `/more#<card>` lands on its page scrolled to the card; `#setup`, unknown and broken anchors stay on More; a reward claimed on a group page shows there. Moved specs keep their assertions (the states test now covers two pages). |
| G3 Visual | ✅ looked at | `/more` and the four pages at 390 px, EN and TH. Mac baselines need `npm run e2e:update` (More changed; the icon from Phase A). |
| G4 UX | ✅ | `/more` is the progress card plus four rows instead of ~3,400 px of cards. 44 px targets. Each page has one h1 and a "Back to More" link with its own accessible name. The shell's theme/language/a11y loops now visit the four pages too. |
| G5 Data & security | ✅ | No data or server change. `hashRedirect` can only produce `/more/<group>#<id>` for a listed id (no open redirect). |
| G6 Production | ⏳ | After merge: `npm run qc:prod`; open an old `/more#notifications` link on the phone. |
| G7 Independent review | ✅ PASS (round 1, no S1/S2) | `docs/qa/REVIEW-D-review.md`. Fixed after: D-1 (each page shows every reward it claims; from More, editing setup returns to More; test-first), D-2 (a broken `#%` no longer crashes More; test-first), D-3 (shell loops cover the four pages), D-4 (in-app "More → …" wording), D-5 (Thai names and lists; EN "Getting started"), D-6 (owner docs), D-7 (anchors checked in the viewport, `#setup` tested), D-9 (DECISIONS). |

Known issues (S4, deferred):
- **D-8:** the card list per group lives in `lib/more/groups.ts` and in the JSX; E2E checks they agree. The Data & account row uses the upload icon (no better one in the set yet; Phase F art).
- **Not from Phase D:** `story` STORY-R1 and `streak` CJ-M9-1 fail when the suite runs in the early morning Bangkok time (an evening overlay covers what they tap); both pass in the daytime run. Suggested as a separate task.
