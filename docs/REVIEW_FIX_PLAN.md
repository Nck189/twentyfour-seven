# Fix plan from the 2026-11-16 project review

Source: `docs/qa/PROJECT-REVIEW-2026-11-16.md` (read it first; it has the evidence).
Goal: make 24/7 easy to enter, easy to use daily, and able to spread. No new game systems.

Written for whoever implements it (Minnie hands this to another session). It is the spec for these changes: where it is exact, build that; where it says "decide", pick the simpler option and log it in `docs/DECISIONS.md`.

## Rules (unchanged, repeated so this file stands alone)
- Read `CLAUDE.md`, `docs/QA_QC.md` and the top of `docs/PROGRESS.md` first.
- **One phase = one PR**, in the order A → B → C → D. Phase E is design only.
- Start each phase on a new local branch from `origin/main` (after PR #25 is merged). Push only to `claude/practical-cannon-a70ubq`, open a draft PR, subscribe to it.
- **Test-first.** For every behaviour below, write the failing test named in "Tests", then the code.
- Each PR passes gates G1–G7 (an independent G7 review included) and gets a short `docs/qa/<phase>-report.md`.
- Every string goes through i18n, EN and TH. Art: tokens only, no black, no outlines, hand-built SVG from `components/art/`.
- Rewards, tickets and coins are decided on the server only.
- A migration is applied to prod only by Minnie (`npx supabase db push --remote`), **before** the code that needs it is merged. Only Phase C has one.
- Merge only on Minnie's "ok merge" with green CI. Never skip a test to get green.

## Decisions for Minnie (defaults are used unless she says otherwise)
| # | Decision | Default in this plan |
|---|---|---|
| 1 | The app's public address printed on pictures | `twentyfour-seven.vercel.app` (changes in one place if she buys a domain) |
| 2 | A QR code on shared pictures (adds one small dependency) | Yes |
| 3 | Landing-page words (drafts in B1) | Use the drafts; she edits later |
| 4 | Google sign-in (needs a 10-minute setup by her, B2) | Build it switched off; she turns it on |
| 5 | A new player's first setup pays 1 capsule ticket (C4) | Yes, in place of nothing: the 2 strawberry seeds stay |
| 6 | More becomes 4 groups with sub-pages (D) | Yes |

---

## Phase A — every share leads back (no migration)

### A1. The app's address on every picture
**Now:** `lib/share/weekPicture.ts` draws "My week on 24/7" with no address. `lib/share/picture.ts` (free times) has none either.
**Build:**
- `content/site.ts`: `SITE_HOST` (from `NEXT_PUBLIC_SITE_URL` when set, else `twentyfour-seven.vercel.app`) and `siteUrl(path, from)` that adds `?from=<source>`.
- Week picture: a footer on the soil area. Left: the app mark (`components/art/AppMark.tsx`) + `SITE_HOST` in `--ui-text`. Right: a QR code of `siteUrl("/", "week")`, about 96 px, on a rounded `--art-cream` square, modules in `--ui-text` (dark brown, never black).
- Free-times picture: the footer shows the owner's own share link (already in `ShareCard` as `url`) as the QR and text, so a friend can book from the picture. No link yet → the site address.
- QR: `qrcode-generator` (zero dependencies). Put the matrix maths behind a pure `qrMatrix(text): boolean[][]` in `lib/share/qr.ts`.
**Tests:** unit: `siteUrl`; `qrMatrix` returns a square matrix with the three finder patterns; the footer's rectangle stays inside the 540 × 675 card. E2E (Chromium, extend the `stats.spec` download check): the picture still downloads. Then look at one real PNG in EN and TH and scan its QR with a phone or a decoder before calling it done.
**Done when:** a phone camera pointed at the picture opens the app's front page.

### A2. The visitor page invites the visitor
**Now:** `components/share/ShareView.tsx` ends with a privacy footer. A friend who books a time is never told what made the page.
**Build:** a card under the slots, and again right after "request sent": title "Made with 24/7", one line ("Plan your day in 7 blocks and grow a small farm"), a button "Start your own — free" → `siteUrl("/", "share")`. New keys under `share.cta*`. No owner name anywhere.
**Tests:** extend `tests/e2e/share.spec.ts`: the link is visible before and after sending a request and points to `/?from=share`. a11y check stays green.

### A3. A preview picture when a link is pasted
**Now:** `app/layout.tsx` metadata has a title and description only, so LINE, IG and iMessage show a bare line.
**Build:**
- `scripts/make-og.ts`: renders a 1200 × 630 card from the app's own art (sky, soil, Som, ripe crops, farmhouse, the tagline) using the same approach as the week picture (`renderToStaticMarkup` + `resolveVars` from `lib/share/weekPicture.ts`, then a Playwright screenshot). Output `app/opengraph-image.png` and `app/twitter-image.png`, committed. Add `npm run og`.
- `metadataBase`, `openGraph` and `twitter` in `app/layout.tsx`. `/share/[token]` keeps the generic picture and a generic title (no owner name, stays noindex).
**Tests:** E2E: `GET /login` HTML has `og:image` and `twitter:card`; `GET /opengraph-image.png` is 200 without a session (the proxy matcher already skips `.png`). Unit: the PNG is 1200 × 630.

### A4. Offer the picture at proud moments, with her own farm
**Now:** the only share button is at the bottom of Stats → Overview, a tab new players don't have. The farm in the picture is the same for everyone.
**Build:**
- Rename/generalise the drawer to `lib/share/cardPicture.ts`: `cardPicture({ title, lines, ring?, scene, footer })`. `weekPicture` becomes a thin caller.
- `lib/share/farmSnapshot.ts` (pure builder + one loader): from her own rows (plots, animals, farmhouse level; RLS, read-only) pick up to 3 crops (ripest, then rarest), up to 2 animals, the farmhouse at its real level. Empty farm → the current generic scene.
- `components/share/ShareMoment.tsx`: one secondary button "Share" that builds the picture ahead of the tap (iOS share sheet must open inside the gesture, as `WeekShare` does) and falls back to a download.
- Put it in three places, after the reveal is finished, never blocking "Done":
  1. `components/exercise/HatchReveal.tsx` → "My <animal> hatched" + the animal's art large.
  2. `components/farm/CapsuleSheet.tsx` `Reveal` when any result is epic or legendary → the crop's art large.
  3. `components/streak/StreakChip.tsx` `StreakNotice` at 7, 14, 30, 60, 100 days → the streak sun + the number.
- Log `share_made` with `{ kind }` through `logEvent` (no private data). Check it against the events deny list in the latest migration; a new client event type must be allowed.
**Never on a picture:** tasks, names, times, notes, email.
**Tests:** unit: `farmSnapshot` picks and orders correctly and handles an empty farm; nothing private in the builder's output type. E2E: hatch flow (`animals.spec` CJ-13) shows "Share" after the reveal and a download starts on Chromium; reduced motion still shows the button.

### A5. Don't offer an empty picture
**Build:** `components/stats/WeekShare.tsx` renders only when `weekShare(...).days > 0`.
**Tests:** unit on the condition; update the `stats.spec` check to seed one logged day first.

---

## Phase B — a front door (no migration)

### B1. Landing page at `/`
**Now:** `next.config.ts` redirects `/` → `/today`, and the proxy sends signed-out people to `/login`: a sprout, a tagline and an email box.
**Build:**
- Remove the `/` redirect from `next.config.ts`. Add `/` to `PUBLIC_PATHS` as an exact match only (`lib/supabase/proxy-session.ts`: today `isPublicPath` also matches prefixes, and `/` must not make everything public). Signed-in on `/` → redirect to `/today` in the proxy, like `/login` today. The manifest's `start_url` is already `/today`, so the installed app never shows the landing.
- `app/page.tsx` + `components/landing/Landing.tsx`, static, one screen at 390 px, then scroll:
  1. Language switch (reuse the login one).
  2. A farm scene from the real art (`FarmSky`, plots at stages 0–3, Som, `Farmhouse`). With motion allowed, the crops step through their stages once; with reduced motion they stand ripe.
  3. Headline + one line + the primary button "Start free" → `/login`. A text link "I have an account" → `/login`.
  4. Three short rows, each with a piece of art: plan tonight; check in with one tap; your farm grows from real days.
  5. The privacy promise in one line, linking nowhere (the full text is in More).
- Draft words (Minnie edits later):
  - EN: "Your day in 7 blocks. Live them, and your farm grows." / "Plan tonight. Tap when you start. Watch it grow."
  - TH: "วันของคุณมี 7 บล็อก ทำได้จริง ฟาร์มก็โต" / "วางแผนคืนนี้ กดตอนเริ่ม แล้วดูฟาร์มโต"
- Keep `/login` as it is; add a small "What is 24/7?" link back to `/`.
**Tests:** E2E (`landing.spec.ts`): signed-out `/` shows the headline and "Start free" → `/login`; signed-in `/` lands on `/today`; `/plan` signed-out still goes to `/login` (the exact-match guard); no horizontal scroll at 390 px; a11y clean; TH renders. Lighthouse stays ≥ 90 (`npm run qc:prod` covers it after deploy).

### B2. Google sign-in, shipped switched off
**Now:** `app/login/LoginForm.tsx` only calls `signInWithOtp`. `app/auth/callback/route.ts` already handles a PKCE `code`, so the return path exists.
**Build:**
- A "Continue with Google" button above the email field, shown only when `NEXT_PUBLIC_GOOGLE_LOGIN === "1"`. It calls `signInWithOAuth({ provider: "google", options: { redirectTo: origin + "/auth/callback" } })`. The email code stays as the second way in.
- A plain text button with no logo. Google has its own rules for its logo, so the official mark is added only if Minnie asks for it.
- `docs/GOOGLE-LOGIN-SETUP.md` for Minnie: create an OAuth client in Google Cloud, paste the client id and secret into Supabase → Authentication → Providers → Google, add the site to the redirect list, set `NEXT_PUBLIC_GOOGLE_LOGIN=1` on Vercel, redeploy. No key goes in git or chat.
- **Check before turning on (write the result in the setup doc):** a person who already has an email-code account and then uses Google with the same address must land in the same account, not a second one.
**Tests:** unit/E2E: without the flag the button is absent; with it, tapping it navigates to `/auth/v1/authorize?provider=google` (intercept the request; no real Google call in tests).
**LINE and Apple:** not in this phase. First read the current Supabase docs for LINE; report what it needs to Minnie.

### B3. People arriving inside LINE or Instagram
**Why:** links shared in LINE/IG open in an in-app browser. Google blocks sign-in there, and "Add to Home Screen" doesn't exist there.
**Build:** `lib/platform/inAppBrowser.ts` (pure, from the user-agent: `Line/`, `Instagram`, `FBAN`, `FBAV`). On the landing and login pages, when it matches, show one quiet line: "For the full app, open this page in Safari or Chrome" with a "Copy link" button. Hide the Google button there; the email code still works.
**Tests:** unit on the detector with real UA strings; E2E with a LINE user-agent shows the line and no Google button.

---

## Phase C — the first minute (one migration, C4)

### C1. Day 1 shows one thing to do
**Now (`components/today/TodayScreen.tsx`):** a brand-new account sees the setup card, "I'm up", the current block with two empty stubs, exercise, the unlock line and "See the whole day". Signing up at 23:00 still shows "I'm up — get out of bed" (`showWake` is true because the day's wake was never pressed).
**Build:**
- A pure `firstDay(profile.created_at, wakeDay, timezone)` in `lib/today/`: true during the wake-day the account was created in.
- On the first day:
  - "I'm up" shows only if the account existed before that day's wake window closed. Otherwise a single line: "Tomorrow: tap 'I'm up' when you leave the bed (target 10:00)".
  - Order: setup card → the current block (or the Night ritual offer in Down Time) → the farm strip (C3). Exercise, the unlock line, the setup hint and "See the whole day" go under one closed "More today" disclosure.
- From day 2 nothing changes.
**Tests:** unit on `firstDay` (sign-up before/after the wake, around midnight, another timezone). E2E: a new account at an hour after its wake window has no "I'm up" button and shows the "Tomorrow" line; an account created "yesterday" shows today's normal screen. Existing Today specs sign in with `onboarded: true` and seeded days; check they still pass, and set `created_at` back where a spec needs the normal screen.

### C2. No "go add it in Plan" dead ends
**Now:** the current-block card says "Set a first 10 minutes in Plan" and "No checklist items. Add them in Plan."
**Build:** replace each line with a button that does it in place:
- "+ Pick a first step" opens the chooser from `components/onboarding/First10Step.tsx` for this block only, in a sheet.
- "+ Add a checklist item" is an inline text field that saves to the same place Plan's editor does.
- Minimum acceptable version if the in-place editors turn out large: deep links that open the exact editor (`/welcome?step=first10&from=today`, Plan with that block's editor open). Log which was built.
- Both pay the existing setup rewards (server-checked), so the reward notice appears on Today.
**Tests:** E2E: from Today, add a first step and a checklist item without leaving; both show on the card; the setup rewards arrive once.

### C3. A farm strip on Today (phones)
**Now:** check-ins happen on Today, the farm is on another tab. The iPad already shows the farm in `components/shell/SidePanel.tsx`.
**Build:** `components/today/FarmStrip.tsx`, under the header, below `lg` only: sky, the 7 plots in `DAY_ORDER` at their real stage (`PlotArt` at 44–48 px), Som at one end. Tap → `/farm`. The existing first-10 sparkle lands on the matching plot.
**Watch out:** Today's request count was cut on purpose (task "cut Today's duplicate Supabase loads"). Reuse the farm data hook the side panel uses, load it after Today's own data, and compare the number of requests on Today before and after; it may rise by the farm's reads only, once.
**Tests:** E2E: the strip shows 7 labelled plots, links to the farm, is absent at 1024 px; request-count check as above.

### C4. A first capsule in the first minute
**Now:** `content/unlocks.ts` `SETUP_REWARD.sleep_times` pays 2 strawberry seeds; a new player has 0 tickets.
**Build:**
- `Reward` may be a list; `sleep_times` pays `[{ seed: strawberry × 2 }, { tickets: 1 }]`. Mirror it in a new migration that replaces `claim_setup_rewards` (security definer, `auth.uid()`, `search_path = ''`, once per account through the existing ledger). Accounts that already claimed `sleep_times` get nothing more.
- The "All set" screen at the end of setup (`components/onboarding/`) gets a primary button "Open your first capsule" → `/farm?capsule=1`, which opens `CapsuleSheet`.
**Tests:** unit: SQL mirrors the content (the existing mirror test); integration: the claim pays exactly 1 ticket once, and a second claim pays nothing; E2E: preset → "All set" → capsule reveal.
**Deploy:** Minnie runs `db push` before this PR merges.

### C5. New words get one line
**Build:** with the existing tip system (`content/tips.ts`, `<Tip id>`): a first-sight line for the Gradation block and for Day score. A one-line hint under a block's name on its card the first three days (`blocks.hint.<key>`, EN + TH).
**Tests:** unit on the tip conditions; i18n parity.

---

## Phase D — More in four groups (no migration)

**Now:** `app/(app)/more/MoreScreen.tsx` is one scroll of about 15 cards (about 3,400 px).
**Build:**
- `/more` shows the setup progress card and four rows: **Setup** (your week, first 10 minutes, exercise), **Sharing** (free time, calendar link), **Preferences** (language, appearance, sound & motion, notifications, tips, café), **Data & account** (install, privacy, export, account, delete).
- Each row opens `/more/<group>` with the same cards, unchanged inside.
- Old links keep working: `SETUP_HREF` in `content/unlocks.ts` and any `/more#language`, `#install`, `#exercise`, `#notifications`, `#share`, `#calendar`, `#sound`, `#privacy` are updated, and `/more#<id>` redirects on the client to the right sub-page.
**Watch out:** many specs open More and look for a card (`states`, `data`, `share`, `push`, `tips`, `cafe`, `shell`, `animals` CJ-13b, `ics`). Update each to the new path; do not weaken what they assert.
**Tests:** E2E: each group opens and shows its cards; every old `#` link lands on the right page; back returns to `/more`; touch targets and a11y.

---

## Phase E — friends (design first, do not build yet)
The review's biggest gap is that nothing is done with or for another person. Before any code, write `docs/FRIENDS-DESIGN.md` and get Minnie's OK on:
1. **Invite link** (G5): one link per account; the friend signs up through it; when the friend finishes a first minimum day, both get one capsule ticket, once, server-checked. Limits against farming it (per week, per device).
2. **Wake buddy** (G7): two accounts pair by link; each sees only whether the other pressed "I'm up" in the window today, and a shared streak. Nothing else about the other's day. Either can unpair.
3. Privacy text for both, what a blocked or deleted account leaves behind, and what the retention dashboard should count.
Build only after the pilot (10–20 friends) shows people stay; read `/admin/retention` first.

## After each phase
Update `docs/BUILD_PLAN.md` status, `docs/PROGRESS.md` (what Minnie must do: env, setup, `db push`) and `docs/DECISIONS.md`.
