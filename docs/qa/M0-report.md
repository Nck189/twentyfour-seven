# QC Report — M0: Scaffold, auth, PWA shell, deploy
Date: 2026-11-02 · Commit: see git log ("M0: …") · Prod URL: https://twentyfour-seven.vercel.app

## Gate results
| Gate | Result | Evidence |
|---|---|---|
| G1 Static | ✅ | tsc 0 · eslint (strict + jsx-a11y, max-warnings 0) 0 · prettier clean · i18n 0 missing keys · art lint 0 |
| G2 Functional | ✅ | unit 14/14 (time, sign-in parser) · e2e 112/112 across 6 projects · coverage overall 89% (engine/game not started) |
| G3 Visual QC | ✅ | 120 screenshots (5 WebKit projects × 6 screens × EN/TH × light/dark) reviewed · rubric avg 4.7, min 4 · art lint 0 · baselines created |
| G4 UX QC | ✅ | axe serious/critical 0 on every screen EN/TH light/dark · all controls ≥ 44×44 · no horizontal scroll |
| G5 Data & security | ✅ | secrets check clean · `.env*` untracked · no tables yet besides keep-alive RPC (RLS lands in M1) |
| G6 Production smoke | ✅ | prod e2e 20/20 (iphone + chrome, 4 skipped = need local Mailpit) · Lighthouse mobile /login: Perf 97 · A11y 100 · BP 100 · manifest + SW + icons valid (pwa.spec) |
| G7 Independent review | ✅ (after fixes) | review 1 FAIL (1 S1, 2 S2) → all fixed → re-review: all product findings fixed; remaining S1 was CI keepalive test → fixed (fail-closed route) |

## Rubric (self-review → independent)
| Item | Self | Reviewer | Note |
|---|---|---|---|
| R1 Style compliance | 5 | 4 → 5 | flat, no outlines, palette from reference |
| R2 Consistency | 5 | 4 | app mark built from the reference sprout |
| R3 Readability | 4 | 4 | tab icons readable at 24px; crops come in M6 |
| R4 Layout | 5 | 4 | after fixes: iPad rail logo, safe areas |
| R5 Typography | 5 | 4 | Nunito + IBM Plex Sans Thai Looped; Thai tone marks clear after spacing fix |
| R6 Color & contrast | 5 | 4 | primary/accent darkened to ≥ 4.5:1 |
| R7 Motion | 4 | 4 | only pressed states so far; reduced-motion honored |
| R8 Delight | n/a | n/a | no reward moments in M0 |
| R9 Not AI-looking | 5 | 4 → 5 | hand-built shapes, no gradients/emoji |

## Screenshots reviewed
- screenshots/M0-{login,today,plan,farm,stats,more}-{iphone,iphone-small,ipad-portrait,ipad-landscape,mac}-{en,th}-{light,dark}.png

## Issues found & fixed
| ID | Sev | Found by | Description | Regression test added | Fixed in |
|---|---|---|---|---|---|
| M0-1 | S2 | axe (G4) | Active tab green text 4.16:1 < 4.5:1 | shell.spec G4 axe loop | tokens.css |
| M0-2 | S2 | self visual (G3) | iPad/Mac rail logo clipped at top (safe-top overrode padding) | visual baseline ipad-* | AppShell |
| M0-3 | S2 | self visual (G3) | Thai tone mark on "วันนี้" touching tab icon | visual baseline iphone-small-th | AppShell |
| M0-4 | S1 | deploy | Supabase free tier rejects custom email template → no code in email → iPhone home-screen app couldn't sign in | parseSignInInput.test + CJ-01 paste flow | login paste-link box |
| M0-5 | S2 | deploy | Vercel blocked Git deploys (commit author not a GitHub account) | — (config) | repo git identity |
| M0-6 | S2 | self (G3) | Thai chosen before first login reverted to English after login | data.spec "Thai picked before first login" | ProfileSync first-login write |
| M0-7 | S2 | stress run | Late first-login write could overwrite a newer language choice | atomic `.is(onboarding->locale_set, null)` + stress run | ProfileSync |
| M0-8 | S2 | prod smoke | Language change lost on immediate reload while the save was in flight (clock-skew sensitive) | data.spec "in flight" | clock-free `localeDirty` flag |
| F1 | S1 | G7 | CI never green (G4 sweep timeout, sign-out flake, then keepalive test) | — | timeout 120s, hard nav on sign-out, keepalive fails closed |
| F2 | S2 | G7 | Offline hard navigation showed Next's black English error page | regressions-m0 F2 | self-contained offline.html via SW |
| F3 | S2 | G7 | Reload on login paste step lost the step (iOS evicts PWA while in Mail) | regressions-m0 F3 | pending step in localStorage (1h) |
| F4–F14 | S3/S4 | G7 | don't-tap warning, resend countdown/confirm/429, link-only wording, no milestone codes, SW cache per build, 404/error pages, iPad side panel, dark pill, login language switch, real keepalive test, screenshots of new states | regressions-m0 F4–F13, pwa.spec | various |
| N2 | S3 | G7 re-review | keepalive failed open without a secret | pwa.spec 401 | route fails closed |
| — | S3 | self | secrets check silently skipped the private-key pattern (leading "-") | manual planted-key check | secrets-check uses -e, fails loudly |

## Known issues (S3/S4 only)
| ID | Sev | Description | Plan |
|---|---|---|---|
| K-1 | S3 | Lighthouse TTI on /login 2.6 s (budget 2.5 s for Today) under mobile throttling | M14 perf pass (font subsetting) |
| K-2 | S3 | Visual baselines are macOS-WebKit only; CI runs functional e2e, not visual | run visual locally each milestone |
| K-3 | S3 | WebKit offline mode can't be automated in Playwright on macOS 14 — offline fallback verified in Chromium only | hand-check on Minnie's iPhone (added to questions) |
| K-4 | S4 | Pasting a 6-digit code after a reload sends an empty email (friendly error) — flow is link-only | keep; revisit if SMTP + code email is added |
| K-5 | S4 | offline.html uses the system font (Thai renders fine) | M14 polish |

## Independent review
**Review 1 — FAIL.** Login + EN/TH toggle work; CI never green (S1); offline fallback broken (S2); login paste step lost on reload (S2); 12 S3/S4 polish items. Rubric 4 across R1–R7/R9.

**Re-review — FAIL → resolved.** F2–F14 verified fixed (offline checked in Chromium; WebKit offline can't be automated — hand-check on a real iPhone advised). Remaining S1: keepalive test failed on CI because the route failed open without `CRON_SECRET`; fixed by failing closed. Non-blocking: N3 locale race (fixed with the clock-free flag), N4 code paste after reload (harmless, link-only flow), N5 offline page uses system font (S4). Rubric: R1 5 · R2 4 · R3 4 · R4 4 · R5 4 · R6 4 · R7 4 · R8 n/a · R9 5.
