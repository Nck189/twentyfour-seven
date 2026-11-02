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
| G7 Independent review | see below | |

## Rubric (self-review → independent)
| Item | Self | Reviewer | Note |
|---|---|---|---|
| R1 Style compliance | 5 | | flat, no outlines, palette from reference |
| R2 Consistency | 5 | | app mark built from the reference sprout |
| R3 Readability | 4 | | tab icons readable at 24px; crops come in M6 |
| R4 Layout | 5 | | after fixes: iPad rail logo, safe areas |
| R5 Typography | 5 | | Nunito + IBM Plex Sans Thai Looped; Thai tone marks clear after spacing fix |
| R6 Color & contrast | 5 | | primary/accent darkened to ≥ 4.5:1 |
| R7 Motion | 4 | | only pressed states so far; reduced-motion honored |
| R8 Delight | n/a | | no reward moments in M0 |
| R9 Not AI-looking | 5 | | hand-built shapes, no gradients/emoji |

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

## Known issues (S3/S4 only)
| ID | Sev | Description | Plan |
|---|---|---|---|
| K-1 | S3 | Lighthouse TTI on /login 2.6 s (budget 2.5 s for Today) under mobile throttling | M14 perf pass (font subsetting) |
| K-2 | S3 | Visual baselines are macOS-WebKit only; CI runs functional e2e, not visual | run visual locally each milestone |

## Independent review
<appended after G7>
