# PROGRESS — 24/7

## Now (2026-11-13, afternoon Bangkok)
- ✅ PR #17 (story + café), #18 (M11 push + .ics) and #19 (perf: fewer duplicate loads) merged.
  After #18 Minnie runs `db push` (push, ics) and the one-time VAPID + cron setup (`docs/M11-push-setup.md`).
- 🔄 **M12 PR** (draft): share free times by private link (`/share/<secret>`, free/busy only), copy free times as text or a picture, booking requests with an inbox in More (accept → appointment on that day's plan). 1 migration: share. G7 round 1 FAIL (1 S1, 4 S2) → fixed test-first; re-review next. Needs `SUPABASE_SERVICE_ROLE_KEY` on Vercel (`docs/M12-share-setup.md`).
- Next: M13 factory, M14, closed beta.
- Waiting on Minnie: G7 STORY-R7 (should seasonal seeds plant only in their month and plants wilt after it?).

## ➡️ HANDOFF — read this first (any session: cloud or Minnie's Mac terminal)
Minnie is asleep (from 2026-11-03 ~02:00 Bangkok). The build moved between a cloud session and her Mac; whichever session runs now continues from here.

**0. Only one session at a time.** `git fetch origin`, then look at the newest commit on `origin/claude/practical-cannon-a70ubq` and `origin/main`: if either was pushed less than 30 min ago by another session, it's probably still running. Don't push; re-check in 30 min. Otherwise you're the driver. Work on branch `claude/practical-cannon-a70ubq` (`git checkout claude/practical-cannon-a70ubq && git pull`).

**1. State (2026-11-03 06:55 Bangkok):**
- ✅ PR #3 (Plan redesign) and ✅ PR #4 (onboarding) are merged and live.
- **PR #5 — appointments + 6-digit code login + every G7 S1/S2 fix + 5 new migrations.** Minnie approved merging ("merge นัดได้") — merge when QC is green AND the G7 re-review passes. Fix CI if red (always run `npx playwright test --list` before pushing E2E changes).
  - Stress (head commit `[stress]`): CJ-07 is 0/40 since the sheet-focus fix. The one-tap finish was stuck on "Loading…" (a request that never answered) → every Supabase request now times out at 15 s and the first Plan/backlog load retries once; the stress run verifies it. Failure snapshots + `[diag]` lines are printed into the CI log (the artifact store isn't reachable from the cloud).
  - G7: review 1 (`G7-M1-M3.md`, `G7-M4-M5.md`) → fixed → re-review 1 FAIL → fixed → re-review 2 (`G7-rereview-2-2026-11-03.md`, no S1) → fixed → **re-review 3 PASS** (`G7-rereview-3-2026-11-03.md`, 2026-11-03 07:15 Bangkok). Open S3s: R4-1 (one server target for Today), R4-2 (Plan reload vs a pending edit; next fix), R4-3 (tests).
- **After PR #5 merges, Minnie runs once on the Mac:** `git checkout main && git pull && npx supabase db push --remote` (5 migrations: wake freeze, coin rules, day-plan merge, night window, re-review fixes). The app works before and after; the fixes take effect after.

**2. Then QC, in order (QA_QC.md gates G1–G7, reports in `docs/qa/`):**
- Report drafts exist: `docs/qa/M1-report.md`, `M3-report.md`, `M4-report.md`, `M5-report.md` — fill in G7 (re-review 2) and the final CI numbers; update BUILD_PLAN "Status".
- **On the Mac only:** `supabase start` + `npm run e2e` locally, the live "try to break it" pass, re-record the visual baselines (`npm run e2e:update`; Today/Plan changed on purpose) for G3 of M3–M5, and G6 on prod (`npm run qc:prod`) after the db push.
- Then **M6 (art system + farm scene)**: strict art rules in CLAUDE.md, style = `design/reference-style-a.svg`, no emoji, no AI images.

**3. Rules that still hold:** prod DB migrations only with `npx supabase db push --remote` (the Mac has the credentials; the cloud doesn't), and never merge code that needs a migration before the migration is applied. No destructive remote-DB ops, no force push, no paid upgrades, no secrets in git. Commit per logical step. Give Minnie a short casual-Thai update with **% progress** (formula below) when she's back.

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
- ~~Login with a 6-digit code~~ **Done 2026-11-03:** Minnie set up Gmail SMTP + the code templates + OTP length 6 on prod (`scripts/setup-email.mjs`); the login screen now asks for the 6-digit code only (an old link pasted there still works).
- ~~Run the new DB migrations on prod (PR #5)~~ **Done by Minnie 2026-11-03 ~12:15 Bangkok.** Next on the Mac: `npm run qc:prod` (G6 re-run for M1/M3–M5).
- **Honor system (G7 R2-3 + R3-1), please confirm:** early nights and early appointments now count as planned (an early 06:00 flight → "I'm up" at 06:00 earns the Sunrise ticket, as Today shows). The flip side: you could plan a much earlier wake for tomorrow (≥ 4 h ahead) and press "I'm up" up to 3 h early — before going to bed. The app can't know whether you slept. Fine as an honor system, or should "I'm up" also require that last night's ritual was closed ≥ 3 h earlier?
- **Judgment calls to confirm (DECISIONS 2026-11-03):** backlog coins: 150/day cap, a task finished < 10 min after being added (or its priority raised) pays 10 · Night ticket counts from 14 h to 3 h before the next wake (a short night, e.g. home 03:00 before a 07:00 class, still counts) · Sunrise target freezes 4 h before the wake · bedtime-drift warning compares with the same kind of day.
- **Farm (M6), please confirm:** an "Out late" night excuses that evening's **Free** block only (no weeds). Should it also cover Gradation (if you leave early)? · Decor prices fence 40 / path 30 / flowers 50 / pond 300 coins? · Starter seeds = radish, turnip, lettuce, carrot (free) until the capsule machine (M7).
- **Later (Minnie, 2026-11-03 — "ค่อยทำ โน้ตไว้ก่อน"):** (1) send sign-in emails from a dedicated Gmail (e.g. a new app-only address) instead of Minnie's own — re-run `scripts/setup-email.mjs` with it; later a real email service + own domain (`no-reply@…`) if many friends join. (2) Invite-only sign-up (only friends Minnie invites can create an account) — today anyone with the link can sign up.
- **M12 share (G7 R-M12-14):** should gym/task slots inside Free, and sick/vacation days, show as busy on your share link? Today they show as free.
- **M12 setup at merge:** add `SUPABASE_SERVICE_ROLE_KEY` on Vercel (`docs/M12-share-setup.md`), then `db push`.
- Please test the offline page once on your real iPhone — link + steps sent in chat 2026-11-02; waiting for her result.

---

## Overall progress (Minnie wants a % in every update)
**≈ 52% of M0–M14 · ≈ 63% of v1 (M0–M10)** — 2026-11-03 12:00 Bangkok
- Weight per milestone = its section size in BUILD_PLAN (M0 26 · M1 14 · M2 17 · M3 13 · M4 12 · M5 13 · M6 22 · M7 11 · M8 13 · M9 5 · M10 16 · M11 9 · M12 8 · M13 10 · M14 12 = 201; v1 = 162).
- Credit per milestone: built = 65%, + review fixes = 80%, + G1–G5 = 90%, ✅ (G1–G7 + report) = 100%. Partial features count by share of the milestone's bullets.
- Now: **M0 100% ✅** · M1 92% · **M2 100% ✅** · M3 90% · M4 90% · M5 90% (G7 PASS; left: Mac G3 + G6 after db push) · **M6 55%** (rules, 20-crop art, farm screen, plant/harvest/decor RPCs, tests; left: CI, G7, Mac G3; Minnie approved the screenshots 2026-11-03) · M11 5% · M14 15% · M7–M10, M12, M13 0%.

## Current milestone
**Moved to a cloud session (2026-11-02 ~22:30 Bangkok)** — the local machine hit its usage limit. Work continues on branch `claude/practical-cannon-a70ubq` → draft PR https://github.com/Nck189/twentyfour-seven/pull/1 (not `main`: the prod migration must go first).
- The cloud container has no prod secrets and can't run Supabase locally (image downloads blocked), so **GitHub Actions is the test runner**: `QC` runs on every push; `Stress` runs when the commit message contains `[stress]` (no retries).
- ⚠️ CI uses `retries: 1`, so a flaky test can pass CI. Use the Stress workflow to prove a flake is gone.

### Resume here
1. ✅ ~~CJ-15 flake (S2)~~ **fixed test-first** (`lib/today/foreground.ts`): the foreground refetch now runs only after ≥ 60 s hidden, and a refetch with unchanged data keeps the same `loaded` object (actions/timeline aren't rebuilt). Tests: `tests/unit/foreground.test.ts`, 2 E2E in `tests/e2e/regressions-m3.spec.ts`. **Stress verdict (2 workers × 24, no retries, 2 runs = 576 tests): 0 dropped taps / failed saves; the original two-device CJ-15 never failed.** The 4 failures were setup on Linux WebKit: 2× `page.goto: WebKit encountered an internal error`, 1× goto timeout, 1× a 5 s `toBeVisible` (raised to 15 s). Logged as M3-K1 (S4, test infra).
1b. ✅ Today redesign "one thing at a time" (Minnie's feedback) + auto-retry of failed saves when back online. ⚠️ Visual baselines for Today in `tests/visual` (recorded on the Mac; CI doesn't run them) need re-recording → part of M3's G3.
1c. ✅ PR #1 merged to `main` 2026-11-03 00:25 Bangkok → Vercel deploy.
1e. ✅ 2026-11-03 01:40 — **PR #3 merged** (Plan "feels quick" redesign, no-emoji guard, Night ritual with fewer words). **PR #4 opened: first-run setup (onboarding) + unlocks ladder spec** — Minnie approved merging on green.
1f. Appointments any distance ahead (Minnie: dentist/friends book months ahead) built on top of PR #4: capture line `Dentist 15/3 14:00`, month view, next-appointment line, Night-ritual mention. Ask Minnie before merging.
1g. Flake hunt: QC run #60 had CJ-07 (ipad-landscape) + one-tap finish (iphone-small) flaky with no trace → Stress run targets both (20× each, no retries); QC now keeps the Playwright report on every run.
1h. G7 reviews running in the cloud (code-level; the cloud can't run Supabase, live checks come from CI E2E): re-review M1+M3, first review M4+M5. Then write M1/M3/M4/M5 reports.
1d. ✅ **M5 Backlog** built and merged (PR #2, 2026-11-03 00:50): `lib/backlog` (sort, RCCP capacity, carry-over), `complete_backlog_item` RPC + `coin_grants` ledger, Plan screen backlog + dnd-kit drop targets + capacity bars + item sheet with Move to…, Night-ritual carry-over. CI green (incl. 5 new E2E). Pending: M5 QC report (G3 visual, G7) + touch drag on a real iPhone.
2. ✅ **Prod DB caught up 2026-11-03 ~00:45:** ⚠️ the Supabase CLI now targets the LOCAL stack by default — `npx supabase db push` alone does NOT touch prod. **Always use `npx supabase db push --remote`.** (The first two pushes went to Minnie's local stack; prod was missing M4 + the M1–M3 security migration until the `--remote` push, which also applied M5.)
   ✅ **G6 on prod (M1/M3/M4 code):** `npm run qc:prod` 22/22 passed (iphone + chrome-desktop; dedicated-user tests skip on prod by design), incl. CJ-17 export, smoke, PWA manifest/SW; Lighthouse assertions passed.
3. Write `docs/qa/M1-report.md`, `M2-report.md`, `M3-report.md` (review findings + fixes are listed below), re-review M1+M3 once (G7), then M4 QC (G1–G7) + report.
4. Then M5 Backlog.

### Review M1–M3 fixes done (tests in tests/integration/review-m123.test.ts, tests/e2e/regressions-m3.spec.ts, tests/unit/today.test.ts)
- M3-F1 S1 `_target_wake` ignores client-written `planned` · M1-F1 plots read-only · M1-F3 server-only event types blocked · M3-F4 backfill only past 30 days · M3-F8 old-date logs always backfilled
- M2-F1 timeline gap (tomorrow override / late night) · M3-F2a/b wake card by calendar date (`pickWakeCard`) + foreground refresh · M3-F3 retry queue replays all failed saves · M3-F5 nap survives reload · M3-F6 backfilled start label · M3-F7 long words wrap · M3-F9 field-level upserts · M3-F12 TH "จบบล็อกนี้", now-line · M1-F2 stable export order · M1-F4 CSV formula escape · stale realtime rows ignored · R8 Sunrise reward animation (`RewardBurst`, `TicketArt`)
- Known/deferred: M2-F2 multiple fixed events in different blocks (S3), M2-F4/F5 (S4), M3-F11 offline Today read-only (S3 → M14), background nap alarm needs push (M11)

### Flakes to root-cause (QC runs, passed on retry)
- CJ-14 language toggle (iphone, QC run on 521177e): heading still "More" right after switching to TH.

### M4 built (not yet QC'd)
- Flake to root-cause in M4 QC: CJ-07 (ipad-portrait, QC run #40) — after "Add item" in the ritual's Plan step, "YOP chapter 2" wasn't visible within 5 s; passed on retry.
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
