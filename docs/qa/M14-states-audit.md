# M14 — empty / loading / error states audit (2026-11-16)

Rule: QA_QC "every list and screen has all three, in both languages".

## How
A throwaway Playwright pass at 390 × 844, local Supabase, EN and TH:
- **Empty:** a brand-new account opens Today, Plan, Stats, Farm and More.
- **Error:** the same account with every Supabase REST and functions call aborted (`route.abort("failed")`), 40 s on each screen (past the 15 s request timeout and its retry).

Screens and text were read by hand. Then the gaps were fixed test-first (a failing E2E before each fix).

## Results

| Screen / list | Empty | Loading | Error (EN/TH) |
|---|---|---|---|
| Today | ✅ setup / first-run cards | ✅ | ✅ "Couldn't load today. Check your connection." + Try again |
| Plan + backlog | ✅ "Nothing here yet…" | ✅ | ✅ "Couldn't load your plan." + Try again |
| Stats | ✅ "Not enough days yet…", estimates hint | ✅ | ✅ "Couldn't load your stats." + Try again |
| Farm | ✅ plots, "Nothing to sell yet", animals hint | ✅ | ✅ "Couldn't load your farm." + Try again |
| Factory sheet | ✅ build prompt | ✅ | ✅ |
| Seed dex, Decor shop, Shop/Market | ✅ | ✅ | ✅ |
| **More → Weekly exercise** | ✅ | ❌ → ✅ shows "–" | ❌ → ✅ It used to show the default "3 times a week" as if it were the user's. Now it shows an alert + Try again (CJ-STATE-1). |
| **More → Share → Requests** | ✅ "No requests waiting." | ❌ → ✅ "Requests (…)" | ❌ → ✅ It used to show "Requests (0)", as if nobody had asked. Now it shows an alert + Try again (CJ-STATE-1). |
| **Farm → Animals pen** | ✅ "Work out to hatch…" | ✅ | ❌ → ✅ It used to vanish, so a user with animals would think they were gone. Now it shows an alert + Try again (CJ-STATE-2). |
| More → Café toggle | — | ✅ disabled until loaded | S3 deferred: it stays disabled with no message |
| Farm → Collection book, Today → streak chip | ✅ | ✅ | S3 deferred: hidden if only that load fails (no data lost; back on the next load; when the network is fully down the screen's own error shows) |

Also: More's cards are now named regions (`aria-labelledby`), so screen readers announce them as sections.

## Tests
- `tests/e2e/states.spec.ts`:
  - CJ-STATE-1: More, the goal + inbox error, then Try again;
  - CJ-STATE-2: the pen error, then Try again.
- Both were red before the fix and are green after.
- Related specs still green locally (Chrome):
  - states, share, data, animals, shell, tips, cafe, push, ics, farm, today: 35 passed.
  - Vitest: 685/685.
