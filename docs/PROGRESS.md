# PROGRESS — 24/7

## 🚨 MINNIE IS OUT — maximum autopilot (from 2026-11-02 19:23 Bangkok)
Message from Minnie, relayed via Claude chat: she's away from the computer and wants you to get **as far as possible without stopping**.
- **Don't stop, don't wait, don't ask.** Keep going through the milestones in order: finish M0/M1/M2 QC → M3 → M4 → … → M14.
- **Don't end your turn.** Post each ✅ line as text, then immediately keep calling tools in the same turn. No "should I continue?" messages, no summaries that wait for a reply.
- **Anything that needs her** (logins, approvals, taste calls): don't block.
  - Pick the spec-consistent option.
  - Log it in DECISIONS.md.
  - Add it to "Questions for Minnie (when back)" below.
  - Move on to the next task that doesn't need her.
- **Avoid commands that would trigger a new permission prompt**, since she can't approve while away. Stick to command types already used in this session (npm, npx, git, gh, supabase, playwright…). If a new kind is unavoidable, defer that sub-task, note it, and continue elsewhere.
- **QA/QC gates G1–G7 still apply.** Never trade quality for speed. M6/M7 reviews are notify-only; do not wait.
- **Safety rules are unchanged:** no destructive remote-DB ops, no force push, no paid upgrades.
- **Long context:** keep this file current and continue (compact rather than stop).
- **When she's back**, she wants one short Thai summary of everything done + the questions list. Then delete this section and `MINNIE_IS_OUT.md`.

### Questions for Minnie (when back)
- (none yet)

---

## Current milestone
**M0** fixes pushed, G7 re-review running → then **M3** (M1/M2 built; their reports follow M0).

M3 plan (Today screen + check-ins):
1. Pure `lib/today`: which wake-day "today" is (wake → next wake), timeline = Wake…Free of D + tonight's Down/Sleep (from D+1's plan), current block, on-time (±10 min), backfill detection.
2. Server: `press_wake()` RPC (server clock, target from plan/template, 15-min window, Sunrise ticket +1 once/day, backfill = no ticket); trigger marks block_logs `backfilled` when a timestamp is >10 min from server time.
3. UI: timeline with now line + current block, block sheet (first-10 auto-starts the block → 5 taps for CJ-05), checklist, close with mood/energy, location on Focus/Work, I'm up button, nap timer (20/25 min + alarm), vacation/sick toggle. Optimistic writes with rollback (CJ-16). Events for every action.
4. Journeys: CJ-03, CJ-04, CJ-05, CJ-06, CJ-15, CJ-16. Invariants: day boundary wake→next wake, tz from profile.

## Done
- **Phase 0** ✅ tools + logins (gh, Supabase, Vercel), GitHub repo, Supabase prod project, Vercel auto-deploy from `main`.
- **M0** code + G1–G6 ✅ (report draft: docs/qa/M0-report.md). Pending: G7 reviewer verdict.
- **M1** (built, QC partly): 16 tables + RLS, defaults seeded on sign-up (generated from `content/defaults.ts`), Export JSON + CSV zip, language synced to profile. RLS integration tests 46/46. Migrations applied to prod.
- **M2** (built): `lib/engine` with every SPEC §3 scenario + 8 fast-check invariants, coverage 98.9%.

## Next concrete step
1. Read G7 findings → fix S1/S2 → re-review once → finalize M0 report → ✅ message.
2. M1: G6 on prod (export on prod, seeded defaults for real user), G7, report.
3. M2: report (no UI → G3/G4 n/a), then start M3.

## Blockers
- none

## Notes
- Local dev/tests use local Supabase (`.env.local` NEXT_PUBLIC_* = 127.0.0.1). Prod keys are `PROD_*` in `.env.local`.
- Supabase CLI reads `.env.local` (SUPABASE_DB_PASSWORD) — use `--db-url` for local type gen (`npm run db:types`).
- Playwright pinned 1.61.1 (macOS 14). Visual baselines macOS-only; CI runs functional e2e.
- Prod smoke: `npm run qc:prod` (serial, shared account `smoke-test@twentyfour-seven.invalid`).

## URLs
- Prod: https://twentyfour-seven.vercel.app
- GitHub: https://github.com/Nck189/twentyfour-seven (private)
- Supabase: https://supabase.com/dashboard/project/stxachfrbpcanlqcxmvj (org "Pinto", Singapore, free)
- DB password: `.env.local` → `SUPABASE_DB_PASSWORD`
