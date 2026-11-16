# Whole-project review — UX, convenience, virality (2026-11-16)

Asked by Minnie: "review this whole project then report which should adjust or improve… focus on UX… very viral and convenient".
Nothing here is built yet; each item needs her OK.

## How it was reviewed
- The real app, local build, Chrome at 390 × 844.
- A brand-new account in Thai (login → first Today → setup → every tab) and an account mid-day in English.
- Checked against `docs/GROWTH.md` (G1–G15) and what a stranger sees: `/`, a shared link, the free-time visitor page, the week picture.
- Not done: a real iPhone, real users. There is no retention data yet, so the virality points are judgment, not measurement.

## Verdict
The app is rich and well made once you are inside. It is not viral yet because nothing leads a new person in: every shared thing is a dead end, and the front door is a bare email box. The risk is not missing features; it is too much on the first screen and no loop.

## What is strong
- One art style, cute, and Som's story gives it a face.
- Setup presets: six kinds of life, one tap.
- Fair server-side rewards, privacy promise, export, delete account.
- Empty, loading and error states; Thai and English; offline check-ins.

## Findings, ranked

| # | Area | What I saw | Change |
|---|---|---|---|
| 1 | Viral | The week picture says only "My week on 24/7": no link, no QR. The free-time visitor page has no "make your own" button. A pasted link has no preview image. | Put the app address + a small QR on every picture. Add "Plan your own week — free" on the visitor page after a request is sent. Add a link-preview image. |
| 2 | Viral | `/` is the login form. A stranger sees a sprout, a tagline and an email box; nothing shows the farm or what the app does. | A one-screen landing: the farm growing, three lines, "Start free". Later a guest demo farm (G12). |
| 3 | Viral | Sharing is offered once, at the bottom of Stats → Overview. New users don't have the Stats tab at all. A new user's picture says "0 of 7 days". The farm in it is the same for everyone. | Offer the picture at proud moments (egg hatch, rare capsule, 7-day streak, perfect day), with her own farm and animals in it. Hide it until there is something to show. |
| 4 | Viral | No invite, no friends (G5, G6, G7 are unbuilt). | Invite link with a capsule for both once the friend finishes a first day. Then wake buddy: see if your friend got up on time. This is the daily social reason to open the app. |
| 5 | Convenience | Sign-in is an emailed 6-digit code only: leave the app, open mail, come back. | Add Google sign-in (one tap). LINE and Apple after; LINE needs checking with Supabase. |
| 6 | First minute | The first Today shows seven things at once: setup card, "I'm up", current block, first 10 minutes, checklist, exercise, whole-day link. Two stubs say "add it in Plan". At 23:00 the big button says "I'm up — get out of bed". GROWTH G1 says day 1 is Wake + Night ritual only. | Day 1: one action that fits the hour (night → "Plan tomorrow", morning → "I'm up"), everything else folded. Replace "add it in Plan" with a button that adds it right there. |
| 7 | First minute | The fun part (farm, capsule) is on another tab; Today has no farm art. A new user has 0 tickets. | A small live farm strip at the top of Today, so each check-in visibly grows something. One free capsule right after picking a preset. |
| 8 | Convenience | More is one scroll about 3,400 px tall with about 15 cards. | Four groups with sub-pages: Setup, Sharing, Preferences, Data & account. |
| 9 | Retention | Reminders are the strongest return lever; on iPhone they only work after "Add to Home Screen" and the one-time push setup (M11). | Finish the M11 setup on prod, and ask for the Home Screen install right after the first reward. An App Store wrapper (G13) later. |
| 10 | Words | "Gradation", "First 10 minutes", "Day score" appear with no explanation on first sight. | One short line under each the first time it shows. |

## Suggested order
1. Close the loop on what exists (#1, #3): small, and every share starts working for you.
2. Front door + Google sign-in (#2, #5).
3. First minute (#6, #7).
4. Pilot with 10–20 friends and read `/admin/retention` before building more.
5. Invite + wake buddy (#4), then More (#8).
