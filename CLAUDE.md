> 🚨 **2026-11-02 19:23 — Minnie is away from the computer.** Maximum autopilot: don't stop, don't wait, don't end your turn. Details are at the top of `docs/PROGRESS.md`.

# CLAUDE.md — 24/7

The product spec lives in `docs/SPEC.md` and the milestone plan in `docs/BUILD_PLAN.md`. Read both before starting any milestone. When a spec decision is unclear, ask; don't invent.

## Owner
Minnie, an Industrial Engineering student in Bangkok. She talks in casual Thai mixed with English technical terms, so reply in that style. Keep updates concise and actionable. She knows OEE, SPC, MRP/RCCP, Gantt and PDCA, so use those analogies freely.

## Stack
- Next.js (App Router) + TypeScript (strict) + Tailwind
- Supabase: Postgres, Auth, RLS, Edge Functions, pg_cron. Migrations go in `supabase/migrations/`.
- Vercel hosting; PWA with a service worker and Web Push (VAPID)
- Libraries:
  - dnd-kit for drag and drop
  - next-intl for i18n (EN default, TH)
  - Framer Motion for animation
  - Recharts for charts
  - Zustand for UI state
- Tests:
  - Vitest for pure logic (scheduling engine, gacha math, growth rules)
  - Playwright for key flows at an iPhone viewport

## Architecture rules
- **Scheduling engine** lives in `lib/engine/`. It is pure functions with no I/O, and the scenarios in SPEC §3 are covered by unit tests.
- **Game rules** live in `lib/game/` and are pure, unit-tested functions:
  - growth
  - quality
  - mutations
  - penalties
  - streak
- **Gacha rolls and ticket/coin changes happen server-side**, in Postgres RPC functions (`security definer`, checking `auth.uid()`). The client never decides outcomes.
- **Static content** (crops, animals, rarity tables, seasons, decor) lives in `content/` as typed TS. Never put it in the DB.
- **Every table has RLS** with `user_id = auth.uid()`. Anonymous access is allowed only through token-checked RPCs (v2 share).
- **Time:**
  - Store `timestamptz` (UTC).
  - Compute "days" in the user's timezone (default Asia/Bangkok).
  - A day runs wake → next wake.
- **Events:** write an `events` row for every meaningful user action. Analytics read from data, never from UI state.
- **Strings:** every user-facing string goes through i18n. Never hardcode Thai or English in components.
- **Mobile-first:** design at 390px first, then the iPad/Mac split view. Touch targets ≥ 44px. Every drag has a "Move to…" fallback.
- **Accessibility:**
  - Respect `prefers-reduced-motion`; skip big animations when it is set.
  - Every sound has a mute.

## Art direction (strict)
- **Style:** flat, **no outlines**, pastel, cozy minimal.
- **Never use black (#000) or near-black strokes.** If an outline is unavoidable, use a darker shade of the object's own fill (soft colored outline), ≤ 1.5px.
- **Depth:** 2–3 tones per object (base, a darker same-hue shadow shape, a lighter highlight shape). Light comes from the top-left.
- **Gradients:** only for the sky. No drop shadows, except a soft flat ellipse under objects.
- **Shapes:** rounded and friendly. Keep crops and animals readable at 48px.
- **Assets:** hand-built SVG React components in `components/art/`. Never use AI-generated images.
- **Style reference:** `design/reference-style-a.svg` is the style Minnie picked. Every new asset must look like the same artist made it, so start from its palette, proportions and shading approach.
- **Fonts:** a rounded Latin font + a looped Thai font (e.g. Nunito + IBM Plex Sans Thai Looped), self-hosted via `next/font`.
- **Palette:** define it as tokens in `styles/tokens.css` (soil, leaf ×3, fruit reds, sky by time of day, UI neutrals). Support dark mode for the UI chrome; the farm scene uses its own night palette.

## Sound
- Short SFX via WebAudio synth or CC0 packs:
  - tick
  - harvest pop
  - capsule shake / crack / jingle (pitch rises with rarity)
  - level up
  - animal reactions
- Audio unlocks on the first user gesture (iOS).
- Global mute and a "skip animation" setting.

## Workflow
- **Autopilot:** Minnie has delegated the build. Follow `START_HERE.md`: don't wait for plan approval, and don't ask "should I continue?". Write a short plan into `docs/PROGRESS.md` and proceed. Log any judgment call in `docs/DECISIONS.md`.
- Work one milestone at a time from `docs/BUILD_PLAN.md`, in order.
- **QA/QC is mandatory.** A milestone is done only when it passes gates G1–G7 in `docs/QA_QC.md`, has no open S1/S2 issues, and has a written report at `docs/qa/M<x>-report.md`. Bugs are fixed test-first: write a failing test that reproduces the bug, then fix it.
- Commit per logical step with clear messages. Never commit secrets: `.env.local` stays gitignored, and keys go in Vercel/Supabase env.
- After each milestone, update the "Status" section of `docs/BUILD_PLAN.md` and list anything deferred.
- If something in SPEC conflicts with reality (an API limit, an iOS restriction), stop and explain the trade-off before deviating.
