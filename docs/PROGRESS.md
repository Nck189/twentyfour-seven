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
- ~~Should Work shrink when an evening event doesn't fit? (M2-F3)~~ **Answered 2026-11-02:** yes — Work gives way (down to 50%) before Down/Wake/Sleep, except on days with a class/appointment in Work. Done in `lib/engine/plan.ts` + SPEC §3.
- ~~Should an early "I'm up" (up to 3 h before target) earn the Sunrise ticket? (M3-F10)~~ **Answered:** yes, keep as is.
- **Login on real iPhone is unreliable (S2, found by Minnie 2026-11-02):** the pasted sign-in link is often already used — likely iOS Mail's long-press link preview opens it (one-time token), or an older email's link was pasted. Workaround given: copy the link from Gmail on the Mac and paste via Universal Clipboard. Real fix needs Minnie once: custom SMTP in Supabase (e.g. Gmail app password / Resend) → email template with the 6-digit `{{ .Token }}` (login already accepts codes) — also lifts the ~2 emails/hour limit. Then fix the login hint text.
- Please test the offline page once on your real iPhone — link + steps sent in chat 2026-11-02; waiting for her result.

---

## Overall progress (Minnie wants a % in every update)
**≈ 35% of M0–M14 · ≈ 44% of v1 (M0–M10)** — 2026-11-02 23:30 Bangkok
- Weight per milestone = its section size in BUILD_PLAN (M0 26 · M1 14 · M2 17 · M3 13 · M4 12 · M5 13 · M6 22 · M7 11 · M8 13 · M9 5 · M10 16 · M11 9 · M12 8 · M13 10 · M14 12 = 201; v1 = 162).
- Credit per milestone: built = 65%, + review fixes = 80%, + G1–G5 = 90%, ✅ (G1–G7 + report) = 100%.
- Now: M0 95% · M1 80% · **M2 100% ✅** · M3 80% · M4 65% · M5–M14 0%.

## Current milestone
**Moved to a cloud session (2026-11-02 ~22:30 Bangkok)** — the local machine hit its usage limit. Work continues on branch `claude/practical-cannon-a70ubq` → draft PR https://github.com/Nck189/twentyfour-seven/pull/1 (not `main`: the prod migration must go first).
- The cloud container has no prod secrets and can't run Supabase locally (image downloads blocked), so **GitHub Actions is the test runner**: `QC` runs on every push; `Stress` runs when the commit message contains `[stress]` (no retries).
- ⚠️ CI uses `retries: 1`, so a flaky test can pass CI. Use the Stress workflow to prove a flake is gone.

### Resume here
1. ✅ ~~CJ-15 flake (S2)~~ **fixed test-first** (`lib/today/foreground.ts`): the foreground refetch now runs only after ≥ 60 s hidden, and a refetch with unchanged data keeps the same `loaded` object (actions/timeline aren't rebuilt). Tests: `tests/unit/foreground.test.ts`, 2 E2E in `tests/e2e/regressions-m3.spec.ts`. **Stress verdict (2 workers × 24, no retries, 2 runs = 576 tests): 0 dropped taps / failed saves; the original two-device CJ-15 never failed.** The 4 failures were setup on Linux WebKit: 2× `page.goto: WebKit encountered an internal error`, 1× goto timeout, 1× a 5 s `toBeVisible` (raised to 15 s). Logged as M3-K1 (S4, test infra).
2. `supabase db push` (prod) → merge to `main` → watch CI → `npm run qc:prod`. **Needs Minnie** (prod secrets aren't in the cloud environment).
3. Write `docs/qa/M1-report.md`, `M2-report.md`, `M3-report.md` (review findings + fixes are listed below), re-review M1+M3 once (G7), then M4 QC (G1–G7) + report.
4. Then M5 Backlog.

### Review M1–M3 fixes done (tests in tests/integration/review-m123.test.ts, tests/e2e/regressions-m3.spec.ts, tests/unit/today.test.ts)
- M3-F1 S1 `_target_wake` ignores client-written `planned` · M1-F1 plots read-only · M1-F3 server-only event types blocked · M3-F4 backfill only past 30 days · M3-F8 old-date logs always backfilled
- M2-F1 timeline gap (tomorrow override / late night) · M3-F2a/b wake card by calendar date (`pickWakeCard`) + foreground refresh · M3-F3 retry queue replays all failed saves · M3-F5 nap survives reload · M3-F6 backfilled start label · M3-F7 long words wrap · M3-F9 field-level upserts · M3-F12 TH "จบบล็อกนี้", now-line · M1-F2 stable export order · M1-F4 CSV formula escape · stale realtime rows ignored · R8 Sunrise reward animation (`RewardBurst`, `TicketArt`)
- Known/deferred: M2-F2 multiple fixed events in different blocks (S3), M2-F4/F5 (S4), M3-F11 offline Today read-only (S3 → M14), background nap alarm needs push (M11)

### M4 built (not yet QC'd)
Night ritual (`components/night/NightRitual.tsx`, auto-offered at Down), Plan week view + DayEditor, `complete_night_ritual` RPC + `ticket_grants` ledger. CJ-07..10 E2E pass. Seed planting deferred to M6.

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
