# G7 independent review: Phase F4 "Pictures on text-only screens"

Scope: commit 4676925 on `phase-f4-local` (`git diff origin/main...HEAD`). Reviewer: independent QA, read-only, 2026-11-23.
Plan: `docs/REVIEW_FIX_PLAN.md` F4. Decision log: "Review fixes, Phase F4" in `docs/DECISIONS.md`.

**Verdict: FAIL.** One S2 is open: the Night ritual banner is cropped where it is used. G3 also fails: R4 scores 3, and the visual baselines were not updated. Everything else is in good shape. The art itself follows the rules, nothing breaks in Thai, dark mode, at 320 px or with reduced motion, and decorative art is hidden from screen readers.

## 1. Spec conformance

| Plan / DECISIONS item | Result | Evidence |
|---|---|---|
| Hand-built SVG in the reference style, readable at 96–160 px | PASS | `components/art/Spots.tsx`: tokens only, no strokes, no gradients, no `<text>`; `art:lint` OK (24 files). Art sheet `spots.png` |
| Empty Stats: Som with a blank chart | PASS (with S3-2) | `StatsScreen.tsx:78-86`. Shown in every empty card, so the same picture appears twice on the Sleep tab and twice on the Days tab |
| Empty backlog: an empty basket | PASS | `BacklogList.tsx:392-396`; `empty-plan-320-th-dark.png` |
| No animals yet: a nest | PASS | `AnimalPen.tsx:228-235`; `empty-farm-320-th-dark.png` |
| No requests: a mailbox | PASS | `ShareCard.tsx:305-310`; `empty-more-sharing-320-th-dark.png` |
| Night ritual header (moon over the farm) | **FAIL (S2-1)** | `NightRitual.tsx:385`. The art is right, but it is cropped where it is used |
| Weekly review header | PASS (with S3-1) | `StatsScreen.tsx:154`. Cropped the same way, less severely |
| Each setup step and "All set" | PASS | `Onboarding.tsx:122,182`; the starter, week, first10 and done spots measured at 120×80 and 168×112 at 320 px |
| Offline and error pages: Som under an umbrella | PASS | `ErrorScreen.tsx:14-18`, `public/offline.html:22`. Every hex in offline.html maps to a current token (checked one by one). The service worker cache is versioned per build, so the new page reaches users |
| 404 keeps the app mark | PASS, reason holds | Nothing went wrong on a 404, so the umbrella would send the wrong message |
| Sky strip on Today that follows the time of day | **Dropped.** Reason holds | The header mark follows the block (F4 part 1). The farm strip, and now its placeholder, already carry the block's sky: verified for sunrise, day and night (`strips-combined.png`). A third sky band would only repeat it |
| Som follows the day; browser tab icon on desktop | Out of scope here | Part 1 was reviewed in REVIEW-F2. The tab icon was deferred there with a reason (DECISIONS, "Som follows the block") |
| Tests: art lint, each piece on `/dev/art`, a look at 48 px and 160 px in light and dark | PASS, with a gap | `app/dev/art/page.tsx:53-73`. The art sheet shows the banners only at their natural 160:56 shape, never at the shape they are actually used at. That is why S2-1 was missed |
| Shorter Today date (not in the plan, logged) | PASS at 375 px; still wraps at 320 px in EN (S3-4) | `lib/format.ts:23-34`, `TodayScreen.tsx:232` |
| Farm strip placeholder in the block's sky (not in the plan, logged) | PASS | Placeholder 343×56 at y = 81.6; the real strip is 343×56 at the same y, so no layout shift. `aria-hidden`. Sky follows the block (sunrise, day, night gradients measured) |
| Not logged: `test.slow()` on CJ-14 and a new "farm yard" visual test | See S3-3 | `tests/e2e/shell.spec.ts:80`, `tests/visual/screens.spec.ts:119-139`. The yard test is not part of F4 and has no baselines |

## 2. Findings

### S2-1: The Night ritual banner is cropped where it is used: the moon, Som's body and the hill are cut off
- **Where:** `components/art/Spots.tsx:440` uses `preserveAspectRatio="xMidYMid slice"`, and `components/night/NightRitual.tsx:385` sizes it `h-16 w-full`.
- **Repro:** at 375 px (or 320 px), 23:30 on a Wednesday (the ritual opens by itself).
  - The box is 343×64 (5.4:1); the art is 160×56 (2.9:1). Slice scales it to the width and shows only y ≈ 13–43 of 56.
  - The top of the moon is cut off.
  - Som is cut below the cheeks, so he looks sunk into the sky band, and the hill he "sleeps on" is gone.
  - The bottom of the farmhouse is cut off.
  - Evidence: `review-f4/night-banner-zoom.png`, `night-375-en-s0.png`, `night-320-th-s0.png`.
- **Why S2:**
  - Every user sees it at every step of the ritual, every night.
  - The main subject (Som asleep) is clipped, which breaks R4 "no clipping".
  - The art sheet hides it, because it renders the banner `w-80 h-auto`.
- **Fix:** draw the banner for the box it lives in (an approximately 160×30 composition, with Som, the moon and the hill inside it), or keep 160×56 and place every element inside the visible band.
  - Add a `/dev/art` cell at the in-place sizes: 343×64 for the ritual, 334×80 and 264×80 for the review.
  - A cheap regression test: check that the banner's box aspect is within ±10% of its viewBox aspect.

### S3-1: The weekly review banner is cropped the same way
- **Where:** `StatsScreen.tsx:154` uses `h-20 w-full`, which makes a 334×80 or 264×80 box.
- **What you see:** the top of the sun and of the left cloud is cut off, and so is the bottom of the soil bed. It still reads as seven growing sprouts. Evidence: `review-f4/review-banner-zoom.png`, `review-320-th-dark.png`.
- **Fix:** the same as S2-1.

### S3-2: The empty-Stats picture repeats within a tab
- **Repro:** a new account, `/stats`, at 375 px.
  - Overview: 1 picture.
  - **Sleep: 2** (Wake-up time and Last 7 days).
  - **Days: 2** (Which days go well and Home vs out).
  - Evidence: `stats-tabs-combined.png`. One `Empty()` is used in 5 cards (`StatsScreen.tsx:283,312,414,466,521`).
- **Why it matters:** the same Som and easel stacked down one screen looks templated, and the plan asked for one picture for "Stats before any data".
- **Fix:** show the picture only in the first empty card of each tab (e.g. `<Empty picture />`), and keep text only in the others.

### S3-3: Visual baselines are stale, and an unrelated visual test has none
- **Where:**
  - The commit changes what these WebKit baselines show: `today-*` (date and strip), `night-close-*` and `night-plan-*` (banner), `offline-*` (new art), `stats-*` (empty spot), `farm-*` (nest) and `plan-*` (basket). None were updated.
  - It also adds a "farm yard" test (`screens.spec.ts:119`), which is not part of F4, with no `yard-*.png` baselines in any of the 5 projects.
  - G3 requires: "no unexpected visual diffs (intended diffs: update baselines and say why in the report)". `npm run e2e:visual` will fail.
  - Found by reading the diff. WebKit isn't installed in this container, so I could not run it.
- **Fix:**
  - Run `npm run e2e:update` on WebKit and look at each diff.
  - Give the reasons in `docs/qa/REVIEW-F4-report.md`.
  - Commit the yard baselines, or move that test into the farm-yard work.

### S3-4: Today's date still wraps at 320 px in English
- **Repro:** at 320×568, EN: the header reads "Wed 28" / "October" on two lines. Thai ("พุธ 28 ตุลาคม") fits on one. Evidence: `night-320-en-s3.png`, behind the sheet.
- **Why it matters:** fixing the wrap was the reason for the change, and 320 px is a width the farm-strip specs already support.
- **Fix:** below about 360 px, use `month: "short"` ("Wed 28 Oct"), or lay out the title row so the subtitle gets the space the chip and menu leave.

### S4-1: Wrong example in a comment
- **Where:** `lib/format.ts:23` says the Thai output is "พ. 28 ตุลาคม".
- **What actually happens:** the real output is "พุธ 28 ตุลาคม", which matches DECISIONS.
- **Fix:** correct the comment.

### S4-2: The new F4 E2E test proves less than its name says
- **Where:** `tests/e2e/farm-strip.spec.ts:131`.
- **What happens:** `getByRole("link", { name: /farm/i }).first()` matches the bottom-nav **Farm** link, which is always there, so "the real strip takes its place" is never checked. "At the same height" is never asserted either. I measured it myself: both are 343×56 at y = 81.6, so the behavior is fine.
- **Fix:** locate `a[href="/farm"]:has([data-plot])` and compare its `boundingBox()` with the placeholder's.

### S4-3: offline.html's art copy has no guard against drift
- **What happens:** DECISIONS says the copy "is generated from the component", but no generator or test was committed. It matches today, but the next change to Som or the tokens will leave it stale without anyone noticing.
- **Fix:** commit the generator, or add a unit test that renders `<SpotArt kind="umbrella"/>` with the tokens resolved and compares it to the `<svg>` in offline.html.

### S4-4: In dark mode the ground "shadow" is lighter than the card
- **What happens:** `Spots.tsx:41` uses `--art-shadow` (#cdbfa6) on the dark surface (#2d2a25). Wide ellipses (rx up to 34 of 96) read as pale platforms, not shadows. Evidence: the dark half of `spots.png` and `empty-*-dark.png`. The existing Som has the same problem, but the spots make it bigger.
- **Fix:** use `var(--shadow-on, var(--art-shadow))` and set `--shadow-on` to a darker shade on dark UI surfaces.

### S4-5: Small things in the night banner
- Som's sleep bubble sits on top of the moon crescent (a blue dot on the moon).
- The hard edge between the two flat sky bands (y = 26 in both banners) reads like a lake or a wall.
- **Fix:** move the bubble, or nudge the moon left or up; soften the edge or move it under the hills.

### S4-6: The umbrella stands on its hook next to Som instead of being held
- The picture still reads as "Som under an umbrella". This is optional.

### S4-7: The review banner always shows steady growth, even when Som says "A hard week"
- This is a mood mismatch. It is optional; it could use a calmer variant for weak weeks.

No S1.

## 3. Visual QC: rubric (1–5)

| # | Score | Reason |
|---|---|---|
| R1 Style | 5 | Flat, no strokes, tokens only, 2–3 same-hue tones, darker shapes lower-right, highlights top-left; the sky uses flat bands (no gradient) |
| R2 Consistency | 4 | The same palette and roundness as the reference and the farm set, with Som reused. The ground ellipses are flatter (ry = 0.11·rx) and much wider than the farm set's (0.22) |
| R3 Readability | 4 | Everything is clear at 96–160 px. At 48 px the nest is a flat brown disc and Som in "starter" is tiny. 48 px isn't required for spots, but worth knowing |
| R4 Layout | **3** | The banners are clipped in place (S2-1, S3-1). Otherwise no horizontal scroll at 320 px, the placeholder causes no layout shift, and the sheet's step heights are unchanged |
| R5 Typography | 5 | No new text. Thai renders correctly next to the art; no tofu or clipping at 320 px |
| R6 Color & contrast | 4 | Text is unchanged. In light mode the offline/error rain and puddle (#c6e0f3 on #f7f4ec) are nearly invisible (decorative only). There are the dark-mode plates (S4-4) |
| R7 Motion | 5 | Nothing new animates. Som's blink inside the spots drops to 0.01 ms × 1 under reduced motion (measured) |
| R8 Delight | 4 | The empty, offline and error screens now feel warm and on-brand. The banners lose their charm when cropped |
| R9 Not AI-looking | 5 | No red flags. Sparkles are few and placed on purpose (1 in Week, 2 in Done, stars at night). One style, one perspective |

**AI-look red flags:** none.
**Art-rule breaches in the source:** none. No `stroke`, no black, no gradient, no drop-shadow or blur, no `<text>`. Every `var(--art-*)` and `var(--sky-*)` token exists in `styles/tokens.css`. offline.html uses resolved token hexes only.
**Against the reference:** the same artist. Leaf-1 and leaf-3 pairs on the sprouts match the reference's #A6D08F and #8CC27A, the soil bed matches its two-tone #CDA582 and #DDBB98, and the lighter left leaf is consistent with the top-left light.

## 4. UX budgets
- **Touch targets:** `expectTouchTargets` passed on the Night ritual (375 and 320, EN and TH) and on the error page (320, EN and TH). The new art adds no controls.
- **States:**
  - Empty: basket, nest, mailbox and chart, all checked live.
  - Loading: the setup spot shows only when `status === "ready"`; the farm strip placeholder is sky and grass.
  - Error: I made `error.tsx` render by returning malformed RPC data, and the umbrella page works in EN and TH at 320 px.
  - Offline: light and dark, EN and TH, at 375 and 320 px. No horizontal scroll, and axe passes.
- **Night ritual height:** steps 0 and 3 fit with the banner at both 375×667 and 320×568. Steps 1 and 2 already scrolled before the banner was added; it adds 76 px to that scroll.
  - `StepBox` keeps its min-height (the banner sits outside it), so a step still never shrinks under a finger.
  - The Close button stays in the header.
- **Layout shift:** the placeholder and the real strip have the same box (343×56 at the same y).
- **a11y:** every `svg[data-spot-art]` and `svg[data-banner-art]` on Stats, Plan, Farm, Sharing, the setup steps, the Night ritual, the weekly review and the error page is `aria-hidden="true"` (checked in the DOM: 0 exposed). The offline svg is `aria-hidden`. The placeholder is `aria-hidden`.

## 5. Checks run
- `npm run art:lint`: OK (24 art files, 74 tokens). `npm run i18n:check`: OK (1339 keys, en = th). `npx tsc --noEmit`: clean. ESLint on the changed files: 0 warnings. Prettier on the changed files: clean.
- `npx vitest run tests/unit`: 474/474 passed (81 files), including the new `formatDayMedium` test.
- E2E on chrome-desktop: `farm-strip`, `onboarding`, `states` and `pwa` 19 passed (1 skipped, needs the cron secret). `night-plan`, `stats`, `backlog`, `animals`, `share`, `today`, `shell` and `regressions-m0`: 58/58 passed.
- A temporary probe spec (deleted afterwards) covered:
  - The farm strip placeholder at sunrise, day and night, TH dark, 375 px: shape, sky gradient, box versus the real strip.
  - The Night ritual at 375×667 and 320×568, EN light and TH dark: each step's sheet client and scroll height, with and without the banner's 76 px, plus touch targets.
  - The offline page at 375 and 320, EN/TH × light/dark, plus axe.
  - Empty states at 320 px, TH dark: Stats, Plan, Farm and Sharing, with art a11y and horizontal scroll.
  - Setup steps (starter, week, first10, done) at 320×568, TH dark.
  - The weekly review banner, seeded (today is a Monday, so the review is open), at 320 TH dark and 390 EN light.
  - Stats tabs with empty data (picture count per tab).
  - The error page, forced through malformed RPC data, EN and TH at 320 px.
  - Reduced motion: animations inside the spots.
- Screenshots reviewed: all 9 in `f4shots/`, the art sheet `spots.png`, and my own in `scratchpad/review-f4/`.
- Not run: the WebKit visual suite, because WebKit isn't installed here. S3-3 comes from reading the diff against the committed baselines. Since WebKit wasn't run, I also didn't check that Safari clips the banner's rounded corners on the `<svg>` itself. Wrapping it in a `div.overflow-hidden.rounded-2xl` would be the safe pattern.

Note: there is no `docs/qa/REVIEW-F4-report.md` yet. Past phases add the report together with their review fixes, so this is expected, but it is required before F4 can count as done.
