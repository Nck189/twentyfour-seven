# 24/7 — Build Plan

v1 = M0–M10, then v2 = M11–M14, built straight through in **autopilot** (see `START_HERE.md`). Claude Code treats each "Prompt" below as its own brief and moves to the next milestone automatically. Environment and account setup is automated in START_HERE Phase 0.

Optional for Minnie: connect the Supabase connector in Claude chat, so chat can analyze her data for weekly reviews.

**Every "Done when" below implicitly includes QA/QC gates G1–G7 and the report (`docs/QA_QC.md`).** A milestone with only its "Done when" met is not done.

---

## M0 — Scaffold, auth, PWA shell, deploy
**Prompt:**
> Read CLAUDE.md, docs/SPEC.md and docs/BUILD_PLAN.md. Start M0. Scaffold Next.js (App Router, TS strict, Tailwind) with:
> - Supabase SSR auth: Google + email magic link
> - next-intl with EN default and TH
> - a PWA manifest and service worker, with placeholder icons drawn as flat no-outline SVG
> - a bottom tab bar on phone (Today · Plan · Farm · Stats · More) and a split view on iPad/Mac
> - a daily keep-alive cron for Supabase
> - Vitest, Playwright and ESLint configured
> - the QA/QC toolchain from docs/QA_QC.md §0:
>   - Playwright WebKit projects for the full §2 matrix
>   - fixed clock + seeded fixtures
>   - visual regression baselines
>   - axe
>   - Lighthouse CI
>   - i18n missing-key check
>   - `npm run qc` / `npm run qc:prod`
>   - a GitHub Actions workflow
> - fonts per CLAUDE.md
>
> List the env vars I must set in Vercel and Supabase. Deploy and give me the steps to install it on iPhone (Add to Home Screen).

**Done when:**
- Login works on the deployed URL from the iPhone home-screen app.
- The language toggle switches EN/TH.
- CI checks pass.

## M1 — Database schema + RLS + seed defaults + export
**Prompt:**
> Start M1. Create Supabase migrations for every v1 table in SPEC §10, with RLS (`user_id = auth.uid()`) and indexes. On first login, seed Minnie's defaults:
> - SPEC §2: the 7 blocks with their durations, the 6 templates with target wakes and fixed events
> - weekly exercise goal 3
> - gym close 22:00
> - tags YOP, Senior project, Class, Personal, Family, Health
>
> Add Settings → Export all data (JSON + CSV per table). Write typed DB helpers.

**Done when:**
- A fresh user gets the defaults.
- Export downloads.
- RLS is verified by a test showing user A cannot read user B's rows.

## M2 — Scheduling engine (pure logic)
**Prompt:**
> Start M2. Implement `lib/engine` per SPEC §3:
> - chain computation from template + target wake
> - night-before bedtime and the bedtime anchor with push
> - snap-back
> - fixed events that win, with the compression order and minimums
> - sleep warning
> - drift guardrail vs the 7-day mean, and the sleep regularity score
> - late-night mode (tagged `planned`)
> - sub-slots that move with their block
> - gym-close warning
> - optional kaizen target shift
>
> Write Vitest tests for every scenario in SPEC §3, plus edge cases (crossing midnight, DST-free Bangkok but timezone-agnostic code). No UI yet.

**Done when:** all scenarios pass and coverage of `lib/engine` is ≥ 90%.

## M3 — Today screen + check-ins
**Prompt:**
> Start M3. Build the Today screen:
> - a vertical timeline of today's 7 blocks (+ sub-slots, fixed events) with the current block highlighted and a "now" line
> - the check-in flow per SPEC §4.3: start, first-10, checklist, close with optional mood/energy, location tag, backfilled label
> - the big "I'm up — out of bed" button with the 15-min window
> - the power-nap timer
> - Vacation/Sick mode toggle
> - write `block_logs`, `wake_events` and `events`
>
> Each check-in must take ≤ 5 seconds one-handed at 390px.

**Done when:** a full day can be logged on iPhone; the data is visible in Supabase.

## M4 — Night ritual + Plan screen
**Prompt:**
> Start M4. Build the Night ritual flow (SPEC §4.1) as a guided sheet that auto-offers at Down Time:
> - 10-min free-phone timer
> - Close today: open blocks + miss-reason tags
> - Plan tomorrow: template picker, bedtime adjust with live engine preview and warnings, edit checklists and first-10 per block
> - "Out late tonight" (late-night mode)
> - Goodnight
>
> Plan screen: a week view where any future day can be planned and overridden without touching templates.

**Done when:** tomorrow can be planned in under 2 minutes, and changing bedtime instantly re-flows tomorrow.

## M5 — Backlog
**Prompt:**
> Start M5. Build the Backlog per SPEC §5:
> - quick-capture inbox
> - fields: tag, estimate, priority (Must / Should / Just start), deadline, sub-checklist
> - week-strip drag & drop with dnd-kit (touch + mouse): drop on a day → that day's Work block, with a "Move to…" fallback
> - iPad/Mac: drop directly on a block
> - capacity bar per day (estimates vs free minutes; red when overloaded)
> - carry-over prompt in the Night ritual, with `carry_count`
> - deadline sorting
> - coins on completion (via RPC)

**Done when:** drag works on iPhone, iPad and Mac; the capacity bar matches a hand calculation.

## M6 — Art system + farm scene
**Prompt:**
> Start M6. Build the art system per CLAUDE.md (flat, no outlines, pastel tokens) and the Farm screen:
> - sky that follows the current block (dusk / stars / sunrise / day)
> - 7 block plots + locked extra field plots
> - crop SVG components with growth stages for the 20 crops in SPEC §8.2
> - quality stars
> - mutation tints/particles
> - weeds, wilt, dead → compost states
> - giant-crop merge visuals
> - juicy harvest animation + pop sound
> - decor shop basics (fences, paths, flowers, pond)
>
> Implement `lib/game` growth/quality/penalty/mutation rules with tests (SPEC §8.1–8.4), driven by `block_logs`.
>
> Build the QC tools for art:
> - `scripts/qc-art-lint.ts` (QA_QC §4.2)
> - a dev-only `/dev/art` sheet rendering every asset × growth stage × state at 48/96/192px on day and night skies
>
> Match `design/reference-style-a.svg`. Pass visual QC (rubric ≥ 4 on every item) BEFORE showing Minnie the screenshots.

**Done when:** a seeded week of logs produces the correct farm state, and the screenshots get Minnie's approval.

## M7 — Economy + gacha
**Prompt:**
> Start M7. Implement tickets, coins and essence server-side (Postgres RPCs, `security definer`):
> - ticket grants: Sunrise, Night, Perfect day, Weekly review, streak milestones
> - `pull_gacha(n)` with the rates and pity from SPEC §8.5, logged in `gacha_pulls`
> - duplicates → essence → star-up
> - Seed-dex with silhouettes and completion %
>
> Build the capsule machine UI with a full animation (shake → crack → rarity light) and a rarity-scaled jingle, plus skip and ×10. Add a Vitest/SQL test that simulates 100k pulls and checks rates and pity.

**Done when:** the simulated rates are within tolerance; the animation feels good on iPhone with sound.

## M8 — Exercise + animals
**Prompt:**
> Start M8. Exercise per SPEC §6: weekly ring, quick log, scheduling as a floating item, gym-close warning. Animals per SPEC §8.6:
> - egg incubator (3 workouts = 1 egg, via a server-side roll)
> - species list and rarities
> - feeding (1 workout = 2 days)
> - produce and love meter
> - hungry = sleepy, never death
> - pet interaction with sound
>
> Animals are flat no-outline SVG with idle animations.

**Done when:** logging a workout visibly feeds animals; a hatch works with its animation.

## M9 — Streaks, modes, seasons
**Prompt:**
> Start M9. Implement minimum day, perfect day, scarecrow freezes (earned every 7-day streak, max 2, auto-used) and Vacation/Sick freezes per SPEC §8.7. Add monthly seasons per SPEC §8.8: limited banner, festival decor, and the month-end harvest festival screen. Write tests for the streak logic, including freeze and planned-deviation cases.

**Done when:** the streak behaves correctly across a simulated month with misses, freezes and vacation.

**Added 2026-11-03 (Minnie): unlocks & milestones (SPEC §8.8b).** Rules in `content/unlocks.ts`, progress as pure functions in `lib/game/unlocks.ts` (unit-tested), grants through a server RPC + read-only `unlock_grants` ledger (counters/ledger can start in M7 with the economy). Collection book on the Farm tab, one "next unlock" line on Today, feature reveals (Stats after 3 days, gacha with the first ticket). **Done when:** each tier unlocks exactly once from real data, and a new user sees fewer tabs/cards until they're earned.

## M10 — Stats + weekly review
**Prompt:**
> Start M10. Build Stats per SPEC §7:
> - Day OEE (A × P × Q, excluding planned deviations)
> - wake-time I-MR control chart (mean ± 3σ, weekday vs weekend, flagged points)
> - sleep regularity
> - block × weekday heatmap
> - miss-reason Pareto
> - home vs out comparison
> - streak calendar
>
> Weekly review on Sunday night: summary + KPT + 3 tickets. Use flat pastel charts consistent with the art tokens.

**Done when:** the numbers match a hand-checked sample week. **v1 complete — use it daily for a few days and fix papercuts.**

---

## M11 — Push notifications + .ics
**Prompt:**
> Start M11. Web Push with VAPID:
> - subscription after a user tap
> - store `push_subscriptions`
> - Supabase pg_cron + an Edge Function that sends: block start, first-10 nudge, "I'm up" reminder, Night-ritual reminder
> - per-type toggles and quiet hours
>
> Handle the iOS constraints (home-screen app, iOS 16.4+, no silent push). Also add an .ics feed URL (secret token) for calendars.

## M12 — Share availability + booking
**Prompt:**
> Start M12. Per SPEC §9:
> - `share_links` with a secret token
> - a public page with no login that shows free/busy only for the next 14 days
> - a request-a-slot form (name + note) through a rate-limited RPC
> - owner inbox: accept/decline; accepted requests become fixed events re-flowed by the engine
> - "Copy free slots" as text and as an image for LINE

## M13 — Factory
**Prompt:**
> Start M13. Factory per SPEC §9:
> - machines (jam jar, cheese press, bakery, loom) with recipes in `content/`
> - real-time production queues (server-validated timestamps)
> - upgrades (speed / capacity)
> - selling products for coins
> - a KPI panel: throughput, utilization, WIP, bottleneck machine
>
> Same art rules.

## M14 — Polish
**Prompt:**
> Start M14:
> - onboarding for a new user (pick durations, templates, targets)
> - performance pass (Lighthouse PWA ≥ 90)
> - accessibility pass
> - empty states
> - error and offline states — incl. a persistent offline queue for check-ins that survives closing the app (Minnie 2026-11-02; step 1, auto-retry on reconnect, shipped in M3)
> - estimate-vs-actual analytics
> - final export/import

---

## Status
- [x] M0 — ✅ 2026-11-02 · `docs/qa/M0-report.md` · live on prod
- [ ] M1 — G1–G7 ✅ (G7 re-review 3 PASS 2026-11-03) · `docs/qa/M1-report.md` · final ✅ once PR #5 is merged and `db push --remote` puts the R-M1-4 fix on prod
- [x] M2 — ✅ 2026-11-02 · `docs/qa/M2-report.md` · deferred: M2-F2 (S3), M2-F4/F5 (S4); open spec question M2-F3
- [ ] M3 — G1, G2, G4, G5, G7 ✅ · `docs/qa/M3-report.md` · left: G3 (Mac visual baselines + rubric), G6 re-run on prod after the db push · deferred S3: R-M3-5..14, R4-1, R4-3
- [ ] M4 — G1, G2, G4, G5, G7 ✅ · `docs/qa/M4-report.md` · left: G3 (Mac), G6 re-run · deferred: seed planting → M6; S3 R4-2 (Plan reload vs edit) next fix
- [ ] M5 — G1, G2, G4, G5, G7 ✅ · `docs/qa/M5-report.md` · left: G3 (Mac), G6 re-run · deferred S3: R-M5-6..11
