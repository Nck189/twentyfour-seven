# Review fix Phase A — G7 independent review

- **Scope:** `git diff 7fcb694..HEAD` on `review-a-local`, commits `deb491c` (A1, A2, A4, A5) and `8071702` (A3, new icon). The merge `0775311` (test-harness change from PR #25: `tests/helpers/auth.ts`, `tests/e2e/shell.spec.ts`, `playwright.config.ts`) and the wording of `docs/REVIEW_FIX_PLAN.md` are not reviewed.
- **Reviewer:** a fresh G7 subagent with no implementation context.
- **Date:** 2026-11-16.

## Verdict: PASS

No S1 or S2. Nothing private reaches a picture, the visitor card, the event or the link-preview tags. There are 6 S3 and 9 S4 findings. Two S3 are worth doing before the free-times picture is used for real: R-A-1 (its QR code is too dense) and R-A-2 (the owner isn't told the picture carries her link).

## What I ran
| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| ESLint and Prettier on the changed files | clean |
| `i18n:check` / `art:lint` | 1245 keys, EN = TH / OK (22 art files, 74 tokens) |
| `npx vitest run tests/unit` | 67 files, 420/420 pass |
| Live policy probe (local Postgres, `pg_policies`) | `events` "own rows: insert" has no `share_made` in its deny list, the same as `20261114000000_factory.sql:44–60` (the newest migration that recreates it). `type` is checked for 1–64 characters only. |
| Real pictures, headless Chrome 153 | I bundled `cardPicture`, `textPicture` and the art with esbuild in a scratch folder and drew 7 pictures: week, hatch (4 farm pieces), capsule in dark mode (1 piece), streak (2 pieces), streak in Thai (4 pieces, house level 9), free times light and dark. I looked at each one. |
| QR decode (OpenCV `QRCodeDetector`) | Every picture decodes at full size to the expected address. Shrunk copies: see R-A-1. |
| Duplicate SVG ids, Chrome 153 | See R-A-3. |
| Theme flip in `lightTokens`, Chrome 153, dark mode | A `.tap` button gets `transitionrun` then `transitioncancel`; its painted color never changes over 400 ms. No flash. |
| The PNGs | Opened `icon-192`, `icon-maskable-512` and `opengraph-image.png`. Sizes are right (180, 192, 512, 512, 1200 × 630). `app/icon.svg` parses as XML. |
| E2E | **Not run** (the server on port 3100 was in use by another process, as instructed). |
| WebKit | **Not run.** It can't run in this container, so every Safari point below is from reading the code. |

## Findings

### R-A-1 (S3) The QR code on the free-times picture is small and dense
- **Where:** `lib/share/picture.ts:57–71`; `components/settings/ShareCard.tsx:137`.
- **What happens:** the share link is 90 characters (a 48-character token), so the code has 41 × 41 modules. It is drawn 92 px wide on a 720 px picture. That is 4.5 real pixels per module, and each dark module is widened by 0.6 px (`cell + 0.3`). The white tile gives 8 px of margin, which is 3.6 modules (the standard asks for 4), and in dark mode the card around it is dark.
- **Evidence:** OpenCV decodes it at full size. After a resize plus JPEG 75 it fails at 85%, 65%, 60% and 50% (it passes at 75%). The week picture's code (33 modules, 5.8 px each) decodes all the way down to 45%.
- **Failure scenario:** Minnie sends the picture in LINE. LINE re-compresses it, the friend long-presses or points a second phone at it, and nothing is found. A phone reader is better than OpenCV, so this may work in practice; I couldn't test with a phone.
- **Fix:** draw each module on whole pixels and bigger: `cell = 3` (6 real px), so the code is 123 px, with a 12 px white margin (4 modules) and no `+ 0.3`. Raise `TEXT_PICTURE_FOOTER` to about 150. Snapping to whole pixels also helps `cardPicture.ts:241–246`.
- **Test idea:** a Chromium E2E that downloads the free-times picture and asserts the QR's box is at least 6 px per module (export the layout numbers, as `FOOTER` is).

### R-A-2 (S3) The free-times picture now carries her live link, and nothing says so
- **Where:** `components/settings/ShareCard.tsx:135–139`.
- **What happens:** `url` is loaded from the database whenever a link exists, not only when she has just copied it. From then on every "Free times as a picture" has a QR code to that link. The card's hint and the button don't mention it. The picture itself does say "Scan to ask me for a time".
- **Failure scenario:** she made the link for one friend last week. Today she posts the picture to an IG story or a class group. Before this change that was a fixed list of times. Now anyone who scans it gets her live free/busy page for the next 2 weeks (with her display name) and the request form, until she replaces the link.
- **Why not S1:** it's her own link, free/busy only, shown on a picture she chooses to send, the caption is on the picture, and "New link" or "Turn off" kills it. The plan (A1) asked for exactly this.
- **Fix:** one line under the button when a link is on, e.g. "The picture has a QR code to your link." Or a small switch "Add my link to the picture".
- **Decision for Minnie:** whether the picture should carry the link by default.

### R-A-3 (S3) The app mark's SVG ids are fixed, so a hidden copy can blank a visible one
- **Where:** `components/art/AppIcon.tsx:68–71`, `components/art/IconSky.tsx:12–21`; hidden copies at `components/share/SharePicture.tsx:102–105` and in the `hidden lg:flex` nav at `components/shell/AppShell.tsx:33`.
- **What happens:** every `AppMark` on a page uses `app-icon-clip-sunrise` and `app-icon-sky-sunrise`. `url(#id)` resolves to the first element with that id. If that one is inside `display: none`, Chrome 153 paints the later, visible mark with no sky at all and no rounded corners (I tested this: the gradient fill renders nothing, the clip is ignored).
- **Today:** no screen hits it. Below 1024 px the first copy is in the hidden nav, and no visible mark follows it inside the app shell. From 1024 px the nav's mark is visible and first. Login, the error page and the visitor page have one mark each. The pictures are safe, because each SVG is drawn as its own image.
- **Failure scenario:** the next visible `AppMark` on a phone screen inside the app shell (an empty state, the Phase B front door reused in-app) shows Som with no sky.
- **Fix:** `useId()` for both ids in `AppIcon`/`IconSky`. `scripts/gen-icons.ts` already writes its own id for `app/icon.svg`.
- **Test idea:** render two `AppIcon`s and assert their ids differ.

### R-A-4 (S3) Long lines on the moment pictures are squeezed
- **Where:** `lib/share/cardPicture.ts:213`; `messages/en.json:1439, 1441`.
- **What happens:** a line has 266 px. Measured at 700 20 px: "Up on time and planned every night" is 339 px and "Legendary crop from a capsule" is 297 px. `fillText`'s max width squashes the letters to fit (22% and 10% narrower). The streak picture shows it clearly. Thai fits (260 and 271 px).
- **Fix:** shorter English ("Up on time, planned every night" still doesn't fit; "On time every morning and night" needs checking), or wrap to two lines, or drop the font size when the text is wider than the box.
- **Test idea:** a unit test that every `share.picture.*Line` in EN and TH, with the longest rarity name, measures under the line width (needs a text measurer, so Playwright).

### R-A-5 (S3) A picture that fails to draw leaves a dead button
- **Where:** `components/share/SharePicture.tsx:91`.
- **What happens:** any error in `cardPicture` (an image that won't decode, `toBlob` returning null) is swallowed. "Share" stays disabled for good, with no message and no retry. On the reveal screens it looks like a broken button under Done.
- **Fix:** on failure, hide the button (a proud moment loses nothing) or show the existing `share.picture.error` line.

### R-A-6 (S3) Visual baselines and the art sheet weren't updated for the new icon
- **Where:** `tests/visual/__snapshots__/*/login-*`, `login-paste-*`, `404-*`, and every iPad/Mac app screen (the nav shows the mark); `app/dev/art/page.tsx`.
- **What happens:** the baselines still show the sprout. CI runs only `tests/e2e`, so nothing fails, but `npm run e2e` and `npm run qc` do. G3 asks for intended diffs to be re-shot and named in the report. `/dev/art` doesn't show `AppIcon` or its three skies.
- **Fix:** re-shoot on a machine with WebKit and add the icon to `/dev/art`.

### R-A-7 (S4) `share_made` is logged on the tap, not on a finished share
- **Where:** `components/share/SharePicture.tsx:133`.
- Closing the iOS share sheet still counts as a share. Log it in the success branch, or add `{ done: false }` on abort.

### R-A-8 (S4) `?from=` is thrown away and never recorded
- **Where:** `lib/supabase/proxy-session.ts:38`; `content/site.ts`.
- A signed-out visitor goes `/?from=share` → `/today?from=share` → `/login` with the query cleared. Nothing reads `from` (only Onboarding compares it to `"more"`). So the links work but measure nothing yet. Keep the query on the redirect and log it once Phase B's front door exists.

### R-A-9 (S4) Link-preview picture: rough edges
- **Where:** `scripts/gen-icons.ts:78–88`; `app/opengraph-image.png`.
- The icon tile's hill is cut straight at the tile's left and right edges, just above the ground band. The tagline wraps to three lines with "grows." alone, close to the crops. The text is in a system font and in English only.
- Fix: let the tile's bottom sit below the ground band's top, and widen the text box or shorten the line.

### R-A-10 (S4) `package-lock.json` lost 60 `libc` fields
- The lockfile was rewritten by a different npm: every optional native package lost `"libc": ["glibc"|"musl"]`. `npm ci` still works, but it can no longer skip the wrong C-library builds. Restore the file and re-add only `qrcode-generator`.

### R-A-11 (S4) Farm layout with 2 or 4 pieces
- **Where:** `lib/share/cardPicture.ts:47–58`.
- Two pieces stand at the far ends (one by Som, one touching the farmhouse) with a gap between. Four pieces are 76 px wide at 55 px spacing, so neighbours overlap a little. Both read fine; spacing 2 pieces at one third and two thirds would look more planned.

### R-A-12 (S4) Accessibility nits
- `components/share/ShareView.tsx:103`: the `aside` is inside `main` (axe "complementary landmark should be top level", moderate; the E2E check only fails on serious).
- `components/streak/StreakChip.tsx:126–143`: "Picture ready." is a `status` inside the notice's own `status`, so a screen reader may read the whole notice again.
- The reveal screens re-centre by a line when "Picture ready." appears.

### R-A-13 (S4) Thai wording
- `ctaTitle` / `pictureApp` "ทำด้วย 24/7" reads like "made out of"; "สร้างด้วย 24/7" is more natural.
- `hatchTitle` "{name}ของฉันฟักแล้ว!" → "{name}ของฉันฟักออกมาแล้ว!".
- `capsuleLine` with the existing rarity name gives "พืชระดับ มหากาพย์ จากแคปซูล" (correct, a little stiff).

### R-A-14 (S4) Test gaps
- No test for the Share button on an epic/legendary capsule or on a streak milestone, for `days` in `StreakNotice`, for the `share_made` row, or for the free-times footer.
- `tests/unit/qr.test.ts` checks the finder patterns but never decodes. One round-trip in Chromium (draw, then decode) would have caught R-A-1.
- `tests/unit/site.test.ts` fails if CI ever sets `NEXT_PUBLIC_SITE_URL` to a host with a port.
- The download checks assume Linux Chromium (no Web Share). That's true in CI.

### R-A-15 (S4) Outside the diff, same file
- `components/settings/ShareCard.tsx:264` revokes the download URL at once. `SharePicture` waits 10 s for WebKit (R-M14-15); the free-times download should do the same.

## Checked and OK
- **Privacy of the pictures:**
  - A week or moment picture holds a title, counts, a default block name, an animal or crop name, a rarity and a streak number. No tasks, names, times, notes or email.
  - `farmSnapshot` returns only crop ids, species and a house level, and reads `plots`, `animals` and `upgrades` under RLS (her own rows). Unknown ids are dropped. A failed read gives the generic farm.
  - The share-link token is only in the free-times QR. Week and moment pictures use `siteUrl("/", "week" | "moment")`. The token is never printed as text: the footer shows the host only.
- **`share_made`:** allowed by the newest `events` insert policy (file and live database). The payload is `{ kind }`. `logEvent` doesn't throw on a refused insert.
- **Visitor page:** the card has the mark, three fixed strings and `/?from=share`. No owner details. `/share/[token]` stays `noindex, nofollow`; its title is "24/7"; the inherited `og:*` tags are generic; no `og:url` or canonical, so the token isn't in any tag.
- **`?from=`:** a fixed union of four words, never read as a redirect target and never rendered. No XSS and no open redirect.
- **`SharePicture` hooks:**
  - Leaving `hero` out of the effect's deps is safe: in all three callers the hero changes only together with the title.
  - `lines` and `ring` are memoised in all four callers, so a parent re-render doesn't redraw.
  - Both effects guard against updates after unmount.
  - The file is built before the button is enabled, and `navigator.share` is called synchronously in the tap in every place.
- **Theme:** `lightTokens` flips and restores `data-theme` in one synchronous step, so two pictures can't interleave, and Chrome paints no flash (tested). The dark-mode capsule picture came out in the daytime palette with `data-theme` unchanged.
- **Farm sizes:** 0 to 4 pieces draw correctly. A farm with no house shows a level-1 house (intended, tested); level 9 draws as the biggest house.
- **Week QR:** 33 modules, 5.8 px each, margin 4.1 to 4.8 modules. The card's rounded corner trims the far corner of the margin to about 3.4 modules; it still decodes at 45% size.
- **Fonts:** the Thai font has weights 400/500/700, so the picture's 600, 700 and 800 all use the 700 face, which the Thai UI has already loaded.
- **`StreakNotice` days:** the server's reasons are `perfect_day`, `streak_7`, `streak_14`, `streak_30`, so `Number(reason.slice(7))` is 7, 14 or 30. A perfect day alone gives 0 and no button. An unknown reason gives `NaN`, which also hides the button.
- **Reveals:** focus still goes to Skip, then Done (`data-hatch-action` / `data-reveal-action`; the Share button has neither). ×10 shares the first crop of the best rarity, and only for epic or legendary. Done is first and never blocked. Both screens fit 375 × 667 with the extra button.
- **Rules:** every new string is in EN and TH. Buttons and the visitor link are at least 44 px. The QR color is the same dark brown as `--ui-text`, never black. The only gradients are skies. No new motion (the mark's blink follows the global reduced-motion rule).
- **Icon:** the maskable icon keeps Som, the ears and the sprout inside the safe circle (checked by maths and by eye). `app/icon.svg` is valid on its own (ids `r` and `app-icon-sky-sunrise`). The manifest is unchanged and its three files exist. Tips keep the sprout (`SproutMark`); login, the error page, the nav and the placeholder take the new mark with no layout change.
- **Tests:** `brand.spec.ts` can pass in CI: `baseURL` is set for `request`, and the proxy matcher skips `.png`, `.svg`, `icon` and `apple-icon`, so those files answer signed-out. The og assertion is a regex, so the absolute production address in the tag is fine.
