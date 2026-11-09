# Playtest plan — simulated players, real app

Minnie asked for this on 2026-11-09: *"once it's done, have agents/sub-agents actually play it for some days, review it honestly like real people, and say what to change so it's easy, sticky, and people don't quit."*

**When to run it:**
- **Main run: after v2 (M14)** — Minnie confirmed "v2" (2026-11-09). Full plan below: 8 personas, 21 in-app days.
- **Recommended pilot: after v1 (M10).** 4 personas, 7 in-app days. BUILD_PLAN already says "use it daily for a few days and fix papercuts". It also tells M11 (push notifications, the main retention lever) what to prioritise, and checks the harness before the big run.

Nothing here runs against production. Findings are proposals: Minnie decides, and nothing is built from them without her OK.

---

## The prompt (paste as the brief for the run)

> **Goal.** Find out whether 24/7 is easy to start, pleasant every day, and worth coming back to for weeks. Do this by having simulated people live with the real app for many in-app days. Then say concretely what to change, ranked by impact on "keeps using it" versus effort.
>
> **Environment.**
> - Run the app locally: `next build` + `next start` against local Supabase, with every migration applied. Never use prod.
> - Drive the UI with Playwright at the persona's device (iPhone / iPad / Mac, WebKit), in their language (EN/TH) and theme.
> - Players must use the UI: what they see, tap and read. They may not call RPCs or write to tables directly. Only the harness may touch the database, for day travel and seeding.
>
> **Start from zero (Minnie, 2026-11-09: "ทำตั้งแต่ set up เลย").**
> - Every persona starts as a brand-new person on the login screen.
> - Sign in with the 6-digit code. Read it from the local mail catcher (Mailpit), the way a person would read their email.
> - Go through the whole first-run setup: language, kinds of day and sleep times, your week, first 10s, .ics import if the persona has a calendar.
> - Then the "Set up 24/7" card, and whatever the app asks for next. Nothing is pre-seeded except what the persona would really bring, such as their class timetable.
> - Day 1 of the diary is the setup day. Note:
>   - time to the first useful screen;
>   - every question that felt unclear or too long;
>   - where they would have given up;
>   - whether they understood what the farm is for before day 2.
>
> **Day travel.** The server uses `now()`, so simulate time by moving the user's history instead of the clock:
> 1. Play day N at realistic local times, setting `page.clock` to each moment. A typical day: wake press, a few check-ins, the night ritual.
> 2. Run a local-only harness function, `qa_shift_user(uid, interval '1 day')`. It moves every date and timestamptz of that user one day back: plans, logs, wakes, snapshots, grants, events, exercise, plants, animals.
> 3. Open the app again. Settling, streaks, growth, hunger and unlocks then run through their real code paths.
>
> Keep the function in `tests/helpers/` SQL, never in `supabase/migrations/`.
>
> **Players.** Run 8 sub-agents in parallel, one per persona. Give each its persona card, a seed, and a daily behaviour model. Each card states, for example: probability of pressing "I'm up" on time, doing the Night ritual, logging workouts, checking the farm; a mood that drifts; real-life events.
>
> Each agent:
> - plays **21 in-app days**;
> - lives through at least one weekend, one month-end harvest festival, one sick day, one out-late night, one broken streak and one 3-day absence;
> - stays in character and does **not** know how the app works beyond what the screens say.
>
> | # | Persona | Device / lang | Behaviour that matters |
> |---|---|---|---|
> | 1 | **Minnie**: IE student in Bangkok, class days + gym | iPhone, TH/EN | The target user. Plans the night before, cares about OEE, likes cute things |
> | 2 | **Night owl**: designer, sleeps 02:00, irregular | iPhone, EN | Often outside the wake window; tests whether the app punishes or helps |
> | 3 | **Busy office worker**: opens it once a day, 30 s | iPhone small, TH | Low effort; tests whether the daily loop fits in under a minute |
> | 4 | **Min-maxer gamer**: reads every number, hoards tickets | Mac, EN | Tests the economy, gacha feel, pity, and whether there's anything to chase after week 2 |
> | 5 | **Lapser**: enthusiastic for 4 days, gone 5, comes back | iPad, TH | Tests the comeback experience: guilt, wilted plants, sleepy animals, how hard it is to restart |
> | 6 | **Non-technical parent**: Thai only, unsure with apps | iPhone, TH | Tests first-run, wording, and whether every screen is obvious without help |
> | 7 | **Accessibility**: reduced motion, large text, sound off | iPhone, EN | Tests that nothing needs animation or sound, targets ≥ 44 px, contrast |
> | 8 | **Rule-bender**: tries to get rewards without doing the habit | Mac, EN | Only through the UI (no API calls). Tests whether a fair player ever feels cheated, and whether the UI invites cheating |
>
> **What each agent writes, each day** (to `docs/playtest/R<round>/<persona>/day-NN.md`, with 1–3 screenshots):
> - what they did, and how long each part took (taps, seconds);
> - what felt good, confusing, annoying or pointless, quoted in the persona's own voice;
> - every place they hesitated, misread or got stuck;
> - their feeling about the farm and animals;
> - one line, **"Will I open it tomorrow? (0–10) — why"**;
> - on the days they skip: why, and what would have brought them back.
>
> **What each agent writes at the end** (`summary.md`):
> - a D1 / D7 / D14 / D21 "still using it?" verdict with reasons;
> - the moment they almost quit;
> - the best moment;
> - the three changes that would matter most to them.
>
> **Synthesis** (one lead agent, after all players finish) → `docs/playtest/R<round>/REPORT.md`:
> 1. **Retention curve** across personas, and the main drop-off reasons.
> 2. **First-run funnel**: where people slow down or give up, in time and in taps.
> 3. **Daily-loop cost**: median taps and seconds per day for each persona. Target: under 60 s on a normal day.
> 4. **Hook check** (trigger → action → variable reward → investment). Name what's weak at each step.
> 5. **Economy balance**:
>    - tickets/coins in vs out per week;
>    - time to the first rare, epic and legendary;
>    - whether a player who keeps going always has a next goal (days 7, 14, 21, 30).
> 6. **Comeback experience**: does returning feel welcoming or punishing?
> 7. **Ethics check**:
>    - no dark patterns;
>    - nothing that pushes against sleep or rest (SPEC: planned deviations are no penalty);
>    - streak pressure stays kind.
> 8. **Ranked change list**, one table with columns ID, problem (with evidence: persona + day + quote/screenshot), proposed change, expected effect on retention, effort (S/M/L), SPEC section touched.
>    - Split it into "quick wins (≤ 1 day)", "next milestone" and "needs Minnie's call".
>    - Write proposals, not code.
>
> **Rules for the agents.**
> - Be honest and specific. "It's nice" is not a finding.
> - Quote the screen text that confused you.
> - Don't invent features that exist, and don't assume ones that don't.
> - Keep the art direction and SPEC in mind when proposing: flat pastel, no emoji, pictures over words, not visually busy.

---

## Setup checklist (before round 1)

- Add `tests/helpers/qa-shift-user.sql` (local only) plus a small harness, `tests/playtest/run.ts`. The harness does nothing on a persona's behalf: each one signs up and sets up through the UI. It only gives each persona a unique email and its real-life inputs (timetable, habits), then loops day → shift → day.
- Make sure local Supabase has every migration (`npx supabase migration up --local`).
- Budget: 8 personas × 21 days is long. If usage limits bite, run 4 personas first (Minnie, office worker, lapser, min-maxer), then the other 4.
