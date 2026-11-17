# Review fix Phase B — G7 independent review

- **Scope:** `git diff 82e0973..2eb5648` on `review-b-local`, commits `6122f77` (B1 + B3) and `2eb5648` (B2).
- **Reviewer:** a fresh G7 subagent with no implementation context.
- **Date:** 2026-11-17.

## Verdict: PASS

No S1 or S2. The route guard opens `/` and nothing else, the front door carries no user data, and the Google flow is the standard PKCE one with a fixed return address. There are 7 S3 and 6 S4 findings. Three S3 are worth doing before Google is switched on: R-B-4 (TikTok and X are not detected), R-B-6 (a cancelled Google sign-in shows the "link expired" message) and R-B-7 (the setup checklist does not test the installed Home Screen app).

## What I ran
| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| ESLint on the 10 changed code and test files | clean |
| `i18n:check` / `art:lint` | 1264 keys, EN = TH / OK (22 art files, 74 tokens) |
| `npx vitest run` on the 3 new unit files | 3 files, 6/6 pass |
| Signed-out probe of the built app on port 3100 (build `2eb5648`, `curl --path-as-is`) | 39 paths; see "Checked and OK". The server went away part-way through the review, so nothing later was probed live. |
| Built client chunk (`.next/static/chunks/3uj28or_4g6ts.js`) | Read the compiled `LoginForm`: see "Checked and OK", Google switch. |
| In-app detector against 29 user-agent strings | See R-B-4. The strings are typed from memory of real ones, not captured from devices. |
| E2E / Playwright | **Not run** (as instructed). |
| Any real browser, WebKit, a real LINE or Instagram app | **Not run.** R-B-1, R-B-2 and R-B-5 are from reading the code and the libraries. |
| Supabase docs | **Not reachable** (`supabase.com` is outside this session's network). See R-B-7 for what that leaves unverified. |

## Findings

### R-B-1 (S3) Someone who has just signed in sees the front door again on Back
- **Where:** `components/landing/Landing.tsx:60`; `app/login/LoginForm.tsx:150` (`router.replace("/today")`); the only guard is `lib/supabase/proxy-session.ts:44`.
- **What happens:** the proxy only sees requests. A new visitor goes `/` → "Start free" → `/login` → types the code → `router.replace("/today")`. History is now `/`, `/today`. Back restores `/` from the browser (Next's router cache, or Safari's page cache), so no request reaches the proxy and the signed-in person sees "Start free". Tapping it within 5 minutes (`x-nextjs-stale-time: 300`) can also show the cached sign-in form.
- **Failure scenario:** Minnie's friend signs up in Safari, swipes back once, and is looking at the page that asks her to sign up. Nothing is lost; a reload fixes it.
- **Not verified in a browser.** This is from how the App Router restores pages on back/forward.
- **Fix:** in `Landing`, on mount and on `pageshow`, check for a session and `router.replace("/today")`. The cheap way is to look for the `sb-…-auth-token` cookie in `document.cookie` (the browser client's cookies are readable), so supabase-js stays out of the landing bundle.
- **Test idea:** E2E: `/` → Start free → sign in with the code → `page.goBack()` → expect `/today`.

### R-B-2 (S3) With reduced motion, the front door fails hydration and is drawn again
- **Where:** `components/landing/Landing.tsx:25, 32`.
- **What happens:** `/` is prerendered (`x-nextjs-prerender: 1`), and on the server `useReducedMotion()` is `null`, so the HTML has four empty plots (stage 0). In the browser, framer-motion reads `matchMedia("(prefers-reduced-motion)")` during the first render (`motion-dom/.../reduced-motion/index.mjs:9–12`, then `useState(prefersReducedMotion.current)`), so a reduced-motion visitor's first client render has four ripe plots (stage 3). The markup differs, React reports a hydration error (#418) and renders the page again on the client.
- **Failure scenario:** every visitor with Reduce Motion on gets a console error, a repaint of the whole page and a jump from bare soil to ripe crops, on the one page that should load fastest. The other four `useReducedMotion` users are pop-ups mounted after a tap, so this is the first place it meets server HTML.
- **Not verified in a browser.**
- **Fix:** read the setting with `useSyncExternalStore(subscribe, () => matchMedia("(prefers-reduced-motion: reduce)").matches, () => false)`, the same pattern as `inApp` on line 65. React then hydrates with the server value and switches to ripe right after, with no error.
- **Test idea:** E2E with `page.emulateMedia({ reducedMotion: "reduce" })`: collect `console` errors and `pageerror`, go to `/`, expect none, and expect the scene to hold four ripe crops straight away.

### R-B-3 (S3) The in-app note is on the front door only; the plan said the login page too
- **Where:** `app/login/LoginForm.tsx` (no note); `docs/REVIEW_FIX_PLAN.md` B3 ("On the landing and login pages"); `docs/DECISIONS.md` 2026-11-17 mentions the front door only and does not record the change.
- **Failure scenario:** a friend opens any other link inside LINE (a `/today` link from a chat, or taps "I have an account"). She lands on `/login`, signs in inside LINE's browser, can't add the app to her Home Screen and is never told why.
- **Fix:** move the note and its button into a small `InAppNote` component and show it on both pages; or log the decision to leave login alone.
- **Test idea:** extend the LINE E2E: `goto("/login")` and expect the note.

### R-B-4 (S3) TikTok, X, Threads and plain Android WebViews are not detected
- **Where:** `lib/platform/inAppBrowser.ts:7`.
- **Evidence (the regex against typical user-agents):** detected: LINE iOS and Android, Instagram iOS and Android, Facebook iOS (`FBAN/`) and Android (`FB_IAB`), Messenger iOS and Android. Not detected: TikTok iOS (`musical_ly_… BytedanceWebview`) and Android (`trill_…`), X on iPhone (`Twitter for iPhone`), Threads (`Barcelona`), WeChat (`MicroMessenger`), KakaoTalk, and any other Android WebView (`; wv)`). X on Android opens a Chrome tab, which is a real browser, so that one is right.
- **No false positives found:** Safari iOS and macOS, Chrome iOS and Android, Samsung Internet, Edge, Firefox iOS, the installed Home Screen app (its user-agent has no `Safari/` but none of the tokens either), `facebookexternalhit`, LINE's link-preview bot, Googlebot, and words that end in "line/" such as `Airline/` or `Baseline/`.
- **Failure scenario:** with Google switched on, a link opened from a TikTok bio shows "Continue with Google"; Google answers with its "disallowed user agent" page and the visitor is stranded outside the app. With Google off, the cost is only a missing note.
- **Fix:** add `musical_ly|trill_|BytedanceWebview|Twitter for iPhone|Barcelona|MicroMessenger|KAKAOTALK` and the Android WebView marker `; wv)`. Do not use "no `Safari/` on iOS" as a signal: that also matches the installed app.
- **Test idea:** add those user-agents to `in-app-browser.test.ts`, plus the installed-app one as a must-stay-false case.

### R-B-5 (S3) "Copy link" does nothing visible when the clipboard is missing or refuses
- **Where:** `components/landing/Landing.tsx:113–118`.
- **What happens:** `navigator.clipboard?.writeText(...).then(...)` short-circuits to `undefined` when `navigator.clipboard` is missing, so there is no error and no feedback. When `writeText` rejects (a WebView that denies it), the handler sets `copied` to `false`, which is what it already was. Either way the button looks dead, and this is the browser family where that is most likely.
- **Also:** "Copied" is not announced (the note has no live region) and never changes back.
- **I could not test inside LINE, Instagram or Facebook.** In current iOS and Android WebViews over HTTPS the clipboard call normally works with a tap.
- **Fix:** on failure, show the address as selectable text (`user-select: all`) with a line such as "Press and hold to copy"; put the button's label in an `aria-live="polite"` span. For LINE there is also its own link switch `?openExternalBrowser=1`, which opens the page in the phone's browser directly (from memory of LINE's developer docs; check before using).
- **Test idea:** E2E with the LINE user-agent and `addInitScript(() => Object.defineProperty(navigator, "clipboard", { value: undefined }))`: tap Copy link and expect the address to be visible as text.

### R-B-6 (S3) A cancelled or failed Google sign-in shows the wrong message, or a raw error page
- **Where:** `app/auth/callback/route.ts:13–21`; `app/login/LoginForm.tsx:89–91, 195–199`.
- **What happens:**
  - Cancel at Google, or any provider error: Supabase returns to `/auth/callback?error=access_denied&…` with no `code`. The route sends that to `/login?error=link`, and the form says "That sign-in link has expired or was already used. Request a new one."
  - The switch is on but the provider is not enabled in Supabase: `signInWithOAuth` makes no network call. It builds the address and calls `window.location.assign` (`auth-js/GoTrueClient.js`, `_handleProviderSignIn`), so `err` is null and the visitor lands on a JSON error page on `supabase.co`. The `if (err)` branch on line 199 almost never runs, and its text is "Couldn't send the code".
- **Fix:** in the callback, when `error` is present and there is no `code`, redirect to `/login?error=google`; add a `login.googleError` string ("Google sign-in didn't finish. Try again, or use the email code."). The setup guide already orders the steps so the provider is on before the switch; say so in one line there.
- **Test idea:** E2E: `goto("/auth/callback?error=access_denied")` and expect the Google message, not the link one.

### R-B-7 (S3) Setup guide: one missing check and three statements nobody has verified
- **Where:** `docs/GOOGLE-LOGIN-SETUP.md:19, 26–28, 31`.
- **The missing check:** the checklist tests "a phone in Safari or Chrome". On iPhone the installed Home Screen app has its own storage, so everyone signs in again there after installing; that is where the button will be used most. Its user-agent has no `Safari/`, Google's sign-in page opens in a sheet over the app, and the PKCE cookie has to survive that round trip. I could not test it and neither did the build. Add: "From the installed app on iPhone: sign out, Continue with Google → you land on Today inside the app."
- **Account linking (line 27), stated plainly:** as far as I know, Supabase Auth does link a Google sign-in to an existing user with the same email automatically, as long as the email is verified on both sides, and an account that has signed in with the email code is verified. **I could not verify this here.** `node_modules/@supabase/auth-js` has nothing on automatic linking (it is server behaviour; the types only cover manual `linkIdentity`), and the Supabase docs were not reachable. `enable_manual_linking = false` in `supabase/config.toml:181` is a different setting and does not turn automatic linking off. The guide states the linking as a fact and then asks Minnie to test it; the test is the right call, so word the sentence as "Supabase should link…".
- **"Turning it off" (line 31):** "Accounts made with Google keep working through the email code" is also unverified. I expect it to hold (the code sign-in finds the user by email), but add it to the checklist.
- **Redirect list (line 19):** "it should already be there" is a guess. `supabase/config.toml:434` lists `https://twentyfour-seven.vercel.app/**` for the hosted project, which covers it if the dashboard matches the file. Make it a definite step and give the symptom: after choosing a Google account you land on the front page with `?code=` in the address (see R-B-8).
- **Correct as written:** the redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`, Web application as the client type, the default scopes, publishing the consent screen, the redeploy after setting a `NEXT_PUBLIC_` value, and the client secret going only into the Supabase dashboard. No secret is in the repo or the guide.
- **Worth one line:** Google's screen will say "continue to `<project-ref>.supabase.co`", not "24/7". That is normal without a custom domain.

### R-B-8 (S4) A sign-in that falls back to the site address now ends silently on the front door
- **Where:** `lib/supabase/proxy-session.ts:37–49`; `app/page.tsx`.
- **What happens:** if the return address is not on Supabase's redirect list, Supabase sends the browser to the Site URL: `/?code=…`. `/` is public, so the landing renders, the code is never exchanged, and nothing explains it. Before this change the same case ended on `/login`, also without a message.
- **Fix:** in the proxy, send `/` with a `code` (or `token_hash`) parameter to `/auth/callback` with the same query.

### R-B-9 (S4) The Google button has no busy state
- **Where:** `app/login/LoginForm.tsx:190–203`. `disabled={busy}` is there but the handler never sets `busy`, so the button stays live for the second or two before the page leaves. A double tap starts two PKCE flows; the later one wins, so it works, but set `busy` for the duration.

### R-B-10 (S4) Test gaps
- **Flag on:** the plan asked for a test that the button goes to `/auth/v1/authorize?provider=google`. Only "off → no button" is automated, because the switch is fixed at build time; `docs/DECISIONS.md` records the "on" case as a hand check. A component test of `LoginForm` with `googleLoginOffered` mocked and `signInWithOAuth` spied would cover `redirectTo`.
- **Guard:** `public-paths.test.ts` could add `""`, `"//"`, `"/ "`, `"/index"`, `"/.."`, `"/%2F"` as must-be-private strings. Next normalises these before the proxy today (probed), so this guards against a later change. The signed-in redirect (`/` → `/today`) is covered only by an E2E that is skipped on prod runs.
- **Not covered:** reduced motion (R-B-2), Back after sign-in (R-B-1), the note on `/login` (R-B-3), a clipboard failure (R-B-5).
- **Flakiness:** I found nothing likely.
  - The a11y check runs while the farm is still growing (3.9 s), but the scene is `aria-hidden` SVG inside `role="img"`, so axe has nothing to measure mid-way, and the helper polls.
  - The LINE test's `browser.newContext()` still gets `baseURL` and the `en-US` locale from the config, and only replaces the user-agent and viewport, so it is the same on the WebKit projects.
  - `toHaveURL(/\/$/)` is right for `http://localhost:3100/`; it would also pass for any address ending in a slash, so `expect(new URL(page.url()).pathname).toBe("/")` inside `expect.poll` is tighter.

### R-B-11 (S4) Thai wording
- `landing.steps.tap.body` "บล็อกละหนึ่งแตะ" reads as a word-for-word translation. "แตะครั้งเดียวต่อบล็อก ไม่ต้องคอยจับเวลา" is more natural. The title uses "กด" and the body "แตะ"; pick one.
- `landing.steps.grow.body`: English says capsules fill, Thai says you get to open them ("ได้เปิดแคปซูล"). Both are fine; they just differ.
- The rest of `landing.*`, `login.whatIs` and `login.or` read naturally and match the English.

### R-B-12 (S4) Small things on the landing
- Before JavaScript runs, the scene is four plots of bare soil. A slow phone shows that for a moment; a visitor without JavaScript keeps it.
- The "skip animation" setting (`skipAnimations` in prefs) is not read; only the system's reduced-motion setting is.
- With the in-app note showing, "Start free" sits about 100 px lower. On a 375 × 667 phone inside LINE's browser (which has its own top bar) it is probably below the first screen. Not measured. The note could go under the buttons.

### R-B-13 (S4) Nothing records that the front door was seen, or where a visitor came from
- **Where:** `content/site.ts:11` adds `?from=week|share|moment|free` to the links on shared pictures; nothing reads it (`grep` finds no reader on `/`), and "Start free" drops it. This is not a regression: before, the proxy dropped it on the way to `/login`. An `events` row needs a user, so the realistic step is to carry `from` through `/login` and write it with the first signed-in event. Without it there is no data on whether the front door or the pictures bring anyone in.

## Checked and OK

**Route guard**
- `isPublicPath` is an exact `=== "/"` test; the prefix rule for the other public paths is unchanged (`proxy-session.ts:8–12`). The proxy matcher (`proxy.ts`) is unchanged by this diff.
- Signed-out probe of the built app (`curl --path-as-is`):
  - 200: `/`, `/?x=1`, `/?_rsc=abc`, and `/.`, `/..`, `/%2e` (Next resolves these three to `/` itself).
  - 307 → `/login`: `/plan`, `/today`, `/welcome`, `/admin/retention`, `/api/push`, `/index`, `/index.html`, `/en`, `/th`, `/TODAY`, `/%2F`, `/%2e/today`, `/./today`, `/%2e%2e/today`, `/;/today`, `/login/../today`, `/_next/../today`, `/icons/../today`, `/fonts/../plan`, `/icon/../today`, `/today?x=.png`.
  - 308 → the clean path, which then gets the 307: `//today`, `/\today`, `/today/`, `//`.
  - RSC requests: `/today?_rsc=abc` and `/today` with `RSC: 1` (with and without the prefetch header) → 307 `/login`.
  - `/x.json`, `/today.json`, `/plan.txt`, `/icon`, `/iconx`, `/sw.jsx` skip the proxy (the matcher's file-type and prefix exclusions, older than this change) and are 404: no page lives there.
- No `basePath` and no locale prefix in the routing (next-intl runs without one), so there is no second spelling of `/`.
- **No redirect loop.** Signed in: `/` → `/today`, `/login` → `/today`, and `/today` passes. Signed out: `/today` → `/login`, and `/login` and `/` are served. One request computes `signedIn` once, no client code redirects to `/login` except sign-out and delete-account (both hard navigations to `/login`, unchanged), and no code navigates to `/` except the new link on the login page.
- **Supabase env missing:** the proxy passes everything through, as before; `/` is static and needs nothing from Supabase.
- **`getClaims` fails:** an auth error returns `{ data: null }`, so `signedIn` is false: `/` shows the front door and app pages go to `/login`. A visitor with no auth cookie never causes a network call (`getClaims` returns as soon as `getSession` finds nothing). Garbage in an `sb-…-auth-token` cookie: `/` 200, `/today` 307, `/login` 200. I guessed the local cookie name, so treat that probe as weak evidence.
- **No user data on `/`.** `app/page.tsx` renders `Landing` only, and the prerendered HTML holds the English copy, the art and the language switch. Language and theme come from `localStorage` after load.
- **Static prerender is safe.** `x-nextjs-prerender: 1`, `Cache-Control: s-maxage=31536000`. The page is identical for everyone; the signed-in redirect is made by the proxy, which runs before the cached page is served, and a 307 with no cache headers is not stored.
- **PWA and deep links.** `start_url` is `/today` (the installed app never opens the front door; signed out it goes to `/login`). `public/sw.js` serves navigations network-first with `/offline.html` as the fallback and stores no pages, so it cannot hold a stale `/`. Push links default to `/today`. `/auth/callback` still ends on `/today` or `/login?error=link`. Shared pictures link to `/`, which now shows the front door: the point of B1.

**Google sign-in**
- `createBrowserClient` sets `flowType: "pkce"` (`@supabase/ssr` 0.12.7, `createBrowserClient.js:44`) and keeps the verifier in a cookie, which the server client in `/auth/callback` reads for `exchangeCodeForSession(code)`. The return is a top-level GET, so a `SameSite=Lax` cookie is sent. It is the same route and cookie handling the email link already uses.
- **No open redirect.** `redirectTo` is `window.location.origin + "/auth/callback"` with no user input, Supabase checks it against its list, and the callback redirects only to two fixed paths on its own origin. There is no `next` parameter.
- **The switch.** `process.env.NEXT_PUBLIC_GOOGLE_LOGIN` is a direct reference, which Next replaces at build time wherever it appears, including inside a callback. In this build the variable is unset, so the chunk keeps the reference against Next's empty `process.env` and the button is off, as intended. I did not build with the variable set; DECISIONS records that the builder did.
- **Hydration.** `/login` prerenders only the Suspense fallback (the app mark); `LoginForm` renders in the browser because of `useSearchParams`, so the button is there from its first paint and nothing shifts. On the landing, `inApp` uses the server value `false` and then updates, with no mismatch.
- The button is hidden during the paste-the-code step and inside detected in-app browsers (unit-tested). It is a text button with no Google logo.

**Rules**
- Every new string is in `landing.*` or `login.*` in EN and TH. "24/7", "EN" and "ไทย" are literals, the same as on the login page.
- The scene uses existing art only (`FarmSky`, `PlotArt`, `CropArt`, `SomArt`, `Farmhouse`, `AppMark`) with token colours. No new SVG, no outline, no shadow. The served page has no duplicate `id`.
- Touch targets: "Start free" 48 px; "I have an account", "Copy link", the language buttons and "What is 24/7?" 44 px.
- A11y: one `h1`; the scene is `role="img"` with a label and `aria-hidden` children; the steps are a list; `role="note"` is valid; the "or" divider is `aria-hidden`.
- Dark mode: UI colours are tokens; the scene keeps its sunrise sky.
- 390 px: `max-w-md`, 16 px gutters, fixed-size art in a `justify-between` row (64 + 4 × 48 + 64 = 320 px inside 334 px). By the class sums, both buttons are above the fold on a 390 × 844 screen without the in-app note.
- The privacy line matches the fuller text in More (`messages/en.json:520`).
