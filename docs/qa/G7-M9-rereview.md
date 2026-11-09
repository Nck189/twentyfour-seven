# G7 re-review — M9 (streaks, seasons, unlock ladder)

**Code:** worktree `/home/user/m6-wt`, branch `m9-local`, head `4eed46c` (fixes vs `46384a5`). Nothing in the repo was modified.
**Method:** a fresh scratch Postgres 16 (port 55447) with the Supabase stub and every file in `supabase/migrations`, acting as `authenticated` with `request.jwt.claim.sub`. Every claim below was exploited or replayed there unless it says "by code". The cluster is now stopped and deleted, and `/tmp/claude-0` is back to 700.

## Verdict: **FAIL** — 2 new S2 open (0 × S1)

**Each reported vector is closed.** All five original S1/S2 repros now fail on the new SQL:
- `{}` / `return_at = now()` / forged `late_night_set_at` / upsert → refused.
- Timezone hop west → refused.
- Yesterday's logs written next morning → `backfilled`.
- Relabelled Must → not counted.

TS⇄SQL settle parity holds: 40 random users × 29 days, 0 mismatches.

**Two other routes reopen the same S2 effects:**
- **R-M9-R1:** changing a row's `date` with UPDATE.
- **R-M9-R2:** a template or plan edit after "I'm up" moves the wake-day back.

Each one again gives a past Vacation/Sick, past planned tags, and yesterday's Perfect day (+1 ticket). Both are exploited below.

| Severity | New open |
|---|---|
| S1 | 0 |
| S2 | 2 (R-M9-R1, R-M9-R2) |
| S3 | 2 (R-M9-R3, R-M9-R4) |
| S4 | 2 (R-M9-R5, R-M9-R6) |

## Original findings

| ID | Sev | Status | Evidence / note |
|---|---|---|---|
| R-M9-1 | S1 | **Fixed** (for the reported vector) | **Refused on scratch:**<br>• `patch_day_plan('2026-11-03','{"late_night":{}}')` → "needs a return time".<br>• `return_at = now()` on Nov 3 / Nov 4 → "night is already over".<br>• Direct insert with forged `late_night_set_at` → refused.<br>• PostgREST-style upsert → refused.<br>• `return_at:"xyz"` → refused.<br>**Stamp:** an `update … set late_night_set_at = '2020-01-01'` is ignored and the server stamp is kept.<br>**Settle:** Nov 2 / Nov 3 stay `missed`.<br>**Residual:** see R-M9-R1 (a date move carries an old stamp) and R-M9-R3. With R-M9-2 a forged late night is now worth only a pause, not a streak day. |
| R-M9-2 | S2 | **Fixed** | Planned late night + in-window wake + no ritual → `paused` (no +1, no Perfect, no milestone), in both `settleStreak` and `settle_days`. A missed wake still misses or freezes, and doing the ritual anyway is a minimum day.<br>The new unit tests cover this, and so does my random parity run, which had valid and too-late stamps. Unlimited pre-set late nights remain (R-M9-R3, S3). |
| R-M9-3 | S2 | **Fixed for timezone hops** (reopened by R-M9-R2) | A user who pressed "I'm up" on Nov 4 tried, in order: Pago_Pago, Etc/GMT+12, Honolulu, New_York, London → all refused ("would reopen a finished day"). Tokyo → BKK → Kiritimati are allowed, and the wake-day stays Nov 4. Etc/GMT+12 from Kiritimati → refused.<br>I also checked by code the transient snapshot that `wake_guard_after` writes after `profiles_timezone_after` has run. It can't leave the final wake-day below the starting one.<br>No legitimate flow writes `profiles.timezone`: onboarding and ProfileSync only read it. The integration tests that switch zones ignore the update error (animals, backlog, streak tz), so they still pass. |
| R-M9-4 | S2 | **Fixed for the reported vector** (reopened by R-M9-R1 and R-M9-R2) | 7 Nov-3 logs inserted on Nov 4 with `now()` → all `backfilled=t`.<br>**Legitimate flows stay live:**<br>• Early press (12:00 target, pressed at ~11:00): today's log stays live, and yesterday's `down` before the target stays live.<br>• After the wake: closing yesterday's `sleep` with the exact client upsert shape (`planned_start`, `items_planned`, `closed_at`), rating it, and `set_block_item` on it.<br>**Correctly backfilled:** a new log for yesterday after the wake, and a `planned_start` 3 days off. |
| R-M9-5 | S2 | **Fixed** | 10 `just_start` paid 10 each, then relabelled `must` → `must_done = 0`, no `must_10`.<br>A Must created < 10 min ago → `paid_as just_start`. Real Musts → `paid_as must`.<br>The backfill (30 → must, 20 → should, else just_start) is conservative: a capped Must is under-counted, never over-counted. |
| R-M9-6 | S3 | **Deferred — acceptable** | An economy and design call for Minnie, with no integrity risk. It must appear in the BUILD_PLAN status / M9 report deferred list. |
| R-M9-7 | S3 | Fixed | `unlockProgress` uses the current `streak` until the goal is earned (unit test). `claim_unlocks` returns `streak`. |
| R-M9-8 | S3 | Fixed | An account ≥ 4 days old is revealed (`accountOldEnough`, unit test). The shell E2E (new user, then 3 `day_results`) still holds. |
| R-M9-9 | S3 | Fixed | `buy_decor` uses the `_wake_day` month, and the client uses `today` from the server. With R-M9-R2 the wake-day can be pushed back across a month boundary (S4 side effect). |
| R-M9-10 | S3 | **Deferred to M10 — acceptable** | It's UI polish tied to M10's reward chest, and SPEC §8.8b is not an integrity issue. Track it in the M9 report. |
| R-M9-11 | S3 | Fixed | `next = SEASONS[month(fest ?? today) % 12]`. EN/TH copy changed to "Look back on {month}" / "ย้อนดูเดือน{month}". |
| R-M9-12 | S4 | Fixed | Exact `"1 scarecrow"`, `wakeDay()` instead of the calendar date, and `expect(error).toBeNull()` on every seed. |
| R-M9-13 | S4 | Mostly fixed | **Fixed:** plurals, a distinct "missed" swatch (`bg-warn-soft`, token exists), and the sign-up day without a wake is no longer "missed".<br>**Deferred and acceptable:** festival counts in `DEFAULT_TZ`, capped completions not counted.<br>**Not addressed and not listed:** the ">60-day gap shows as Before you started" item. List it as deferred. |

## New findings

| ID | Sev | Finding | Where | Repro (scratch PG @4eed46c, now = Nov 4 ~10:45 BKK) | Suggested fix |
|---|---|---|---|---|---|
| **R-M9-R1** | **S2** | **Changing a row's `date` with UPDATE bypasses every past-day guard and the new backfill rule.** RLS lets a client update its own `day_plans` and `block_logs` rows, including `date`, and none of the guards treat a date change as a new row:<br>• `day_plans_past_guard` only fires when `mode` or `late_night` themselves change.<br>• `_stamp_late_night` keeps the old stamp.<br>• `block_logs_planned_guard` only runs `on update of planned_deviation`.<br>• `block_logs_guard` marks a backfill on UPDATE only when `started_at`, `first10_at` or `planned_start` change.<br>**Effects:**<br>• A past Vacation/Sick (erases a miss, and also R-M6-R1 on the farm).<br>• A past planned tag.<br>• Moving today's live logs onto yesterday → yesterday's **Perfect day +1 ticket** (and the first-10 / blocks unlock counts).<br>• Moving an old-stamped Out late onto a past night → pause. | `20261104000000_m9_streak.sql:269-271` (mode compares `old.mode` even when the date changed); `:274` and `:146` (late_night / stamp keyed on value only); `:63` (`update of planned_deviation` only); `:100-105` (date change not considered) | **User a2:** wakes Nov 1–4, Night tickets Nov 1 and Nov 3.<br>• `patch_day_plan('2026-11-02','{"mode":"sick"}')` → refused.<br>• `patch_day_plan('2026-11-20','{"mode":"sick"}')`, then `update day_plans set date='2026-11-02' where date='2026-11-20'` → accepted.<br>• Insert 7 Nov-4 logs with `now()`, then `update block_logs set date='2026-11-03'` → `backfilled=f`.<br>• `settle_days` → `Nov 2: paused`, `Nov 3: perfect (1.00)`, `perfect_day@2026-11-03` granted.<br>**User f1:** today's `free` log tagged `planned_deviation`, then moved to Nov 3 → `planned_deviation=t, backfilled=f`. An Out late stamped Nov 1 on Nov 20's plan, moved to Nov 3 → `Nov 2: paused`. | Forbid changing the identity columns for clients. In a BEFORE UPDATE trigger on `day_plans` and `block_logs`, raise when `new.date`, `new.user_id` (or `new.block`) is distinct from old, with the same service_role bypass. A column-level revoke would break PostgREST upserts, which SET the conflict keys to the same value.<br>Alternatively, treat a date change as an INSERT in all four functions, and re-stamp `late_night_set_at`.<br>**Tests:** "moving a Sick plan / a planned tag / today's logs to yesterday is refused". |
| **R-M9-R2** | **S2** | **After "I'm up" is pressed, a later wake target moves the wake-day back to yesterday.**<br>• `_wake_day` reads only `wake_snapshots` and then the live `_target_wake`. It never reads `wake_events`.<br>• `_wake_before` / `_wake_after` skip days that already have a wake event, so a pressed day is never snapshotted.<br>So after pressing, editing the template's `target_wake` (or the plan's `template_id`, `attending`, or `planned` push) to a later time makes "today" yesterday again. Every guard keyed on `_wake_day` then reopens: Vacation/Sick, planned tags, live check-ins (R-M9-4) and the R-M9-3 premise. Revert the template afterwards and settle. | `20261103060000_m6_farm.sql:61-64` (`_wake_day`); `20261103050000_rereview_fixes.sql:101` (pressed days skipped) | **User a5:** wakes Nov 1–4 (Nov 4 pressed), Night tickets Nov 1–3, no snapshot for Nov 4.<br>• `update templates set target_wake='23:30'` → 0 snapshots.<br>• Insert 7 Nov-3 logs with `now()` → `backfilled=f`.<br>• `update block_logs set planned_deviation=true` on Nov 3 → accepted.<br>• Revert the template → `settle_days` → `Nov 3: perfect (1.00)`, `perfect_day` granted.<br>**User a6** (no ritual Nov 3), same trick: `patch_day_plan('2026-11-03','{"mode":"sick"}')` accepted → `Nov 3: paused` instead of `missed`. | In `_wake_day`, prefer the frozen press: `w := coalesce((select target_wake from wake_events where user_id = uid and date = d), snapshot, _target_wake(uid, d))`. `_night_over_at` already does this. This keeps the current early-press behaviour, which matches the client's `currentDayDate`.<br>**Test:** "press wake, push the template wake to 23:30 → yesterday's Sick / logs still refused or backfilled". |
| R-M9-R3 | S3 | **Out late is unlimited and not bound to its night.**<br>• The guard accepts a late night on any future plan with any `return_at ≥ now − 1 h` (e.g. year 2099).<br>• It is honoured whenever the stamp predates that night.<br>So pre-setting Out late on every future day (a modified client, or patiently via Plan) turns every ritual-less in-window day into `paused`: unlimited free scarecrows, and the Free plot is excused too. Since R-M9-2 it no longer *grows* the streak or pays, hence S3. The original fix suggestion "require a `return_at` inside that night" wasn't taken. | `m9_streak.sql:273-286`; `_late_night_planned` `:175-187` | By code. Single cases were confirmed on scratch: a future late night is accepted with any `return_at`, and a valid stamp → paused. | Require `return_at` to fall within that night (e.g. between D−1 18:00 local and `_night_over_at(D)` + a few hours). Optionally cap it (DECISIONS already offers "1 per 7 days"). This is Minnie's call. |
| R-M9-R4 | S3 | **Existing late nights lose their effect at deploy.** The migration adds `late_night_set_at` with no backfill, so every existing `late_night` row has a null stamp and `_late_night_planned` treats it as not planned. M6 is already on prod:<br>• `_plot_ripe` re-evaluates the whole growth history, so a growing Free plot loses past Out-late excuses (weeds or "not ripe").<br>• The client preview still excuses them (deferred S4), so the farm shows "ready" while `harvest_plot` says "not ripe yet".<br>• The first `settle_days` (up to 60 days back) treats those nights as unplanned. | `m9_streak.sql:133` | Scratch replay: the same farm seed with `set_at` before the night harvests, and with it after the night gives `not ripe yet`. A null stamp behaves the same way (by code). | One-time backfill for rows that exist at migration time. Either grandfather them (`late_night_set_at = least(created_at, updated_at)`, or `'-infinity'` for `date ≤ current_date`, since they were judged by the old rule), or accept it and log it in DECISIONS. |
| R-M9-R5 | S4 | **Ticking items on a finished wake-day's live log still raises yesterday's OEE** (the Performance factor). This is by DECISIONS ("ticking items … later still counts"). With live on-time starts and first-10s, ticking all items the next morning can still turn the day into a Perfect day. | `block_logs_guard` `:100-105` (items not considered) | Scratch: `set_block_item('2026-11-03','sleep',…)` after the wake keeps the log live (expected by design). | Accept and document, or stop counting `items_done` changes made after the next wake for OEE. |
| R-M9-R6 | S4 (pre-existing, outside M9) | **Sign-up freezes the wrong wake target for today and yesterday.** `seed_user_defaults` inserts the templates one by one. The second insert's `wake_guard_before` freezes today's and yesterday's target from the only template present so far (`free_weekday` 10:00). So a Wednesday sign-up after 06:00 is judged against 10:00, not class_wed's 07:30. | `20261102020000_seed_defaults.sql:18-26` + `wake_guard_before` on templates | Observed on scratch: every new user got `wake_snapshots` for Nov 3 and Nov 4 at 10:00, created at sign-up. | Skip the freeze while seeding: insert all templates in one statement, or guard on `auth.users` existence. |

## Deferrals — judgement
- **R-M9-6** (milestones after 30): acceptable to defer. It is economy design, needs Minnie, and has no integrity impact.
- **R-M9-10** (unlock reveal animation and egg hatch → M10): acceptable as S3, provided it is listed in the M9 report / BUILD_PLAN deferred.
- **S4s** (festival tz, capped completions, client farm preview): acceptable. The client farm preview becomes more visible because of R-M9-R4.
- **Missing from the deferred list:** the R-M9-13 ">60 days" label. Add it.

## What I verified and how
- **Scratch cluster.** PG16 on 127.0.0.1:55447 with `stub.sql`, then all 18 migrations applied cleanly (only a `wal_level` warning from the publication). The helper schema `qa` seeded users with fixed wake times, wake events and Night tickets, using `session_replication_role = replica` and clearing sign-up snapshots. I acted as `authenticated` with `request.jwt.claim.sub`, and as `service_role` for seeding.
  - *Incident:* the cluster crashed once mid-run because `/tmp/claude-0` was reset to 700 externally. I set it back to 711 and restarted it; the data was intact.
- **R-M9-1 (`a.sql`).** All late-night forgeries listed in the table were refused, and settle gave `Nov 1 minimum, Nov 2 missed, Nov 3 missed`.
- **R-M9-3 / R-M9-4 / R-M9-R1 (`b.sql`, f1 session).** Original repros refused or backfilled; the date-move bypasses succeeded (results in the table).
- **R-M9-R2 (`c.sql`, users a5/a6).** The template edit after pressing succeeded. The first run (a3/a4) was protected only because the sign-up snapshots existed, which is how I found R-M9-R6.
- **R-M9-5 (`d.sql`).** Relabel → `must_done 2` (real Musts only), no `must_10`.
- **block_logs_guard legitimate flows (`e.sql`).** Early press before the target; close, rate and tick of yesterday's last block after the wake via the exact client upsert shapes and `set_block_item`. All stay live. A new yesterday log after the wake, and an off-day `planned_start`, are backfilled.
- **Timezone probes.** 10 sequential switches, east and west and back; results in the R-M9-3 row.
- **Farm.** I replayed `farm.test.ts` R-M6-2 in SQL: with a valid stamp, `harvest_plot` succeeds; with a stamp after the night, "not ripe yet".
- **Parity (`par.ts`).** 40 users × 29 days (Oct 6 – Nov 3) with Vacation/Sick, in-window / out-of-window / backfilled / no wake, Night tickets, late nights (70% stamped in time, 30% too late), and logs with on-time / late / first-10 / items / backfilled / planned tags. I compared `settle_days` with `settleStreak` on kinds, OEE (±1e-3), streak/best/freezes and non-night grants: **0 mismatches**. The run covered 598 minimum, 382 missed, 164 paused, 12 perfect and 4 frozen days, and 17 grants.
- **Integration tests (reasoned and partly replayed).**
  - **streak.test.ts:**
    - Parity: admin seeds bypass the guards via `current_setting('role')`, and the late-night seed carries `late_night_set_at`.
    - "Can't be faked": expected refusals hold.
    - R-M9-1: refusals and `missed` replayed.
    - R-M9-3: the update errors are ignored, the wake-day never decreases, and Sick on yesterday is refused.
    - R-M9-4 and R-M9-5: replayed.
  - **farm.test.ts:** replayed, as above.
  - **Other tests touching the changed code:**
    - `day-plan-patch`: the date is 3 days ahead, so the late night is accepted.
    - `animals` / `backlog`: timezone updates may now error, but the assertions don't depend on them.
    - `wake.test` live guard: today's log stays live.
  - **Missing tests:** none of them cover R-M9-R1 or R-M9-R2.
- **E2E (by code).**
  - `streak.spec.ts`: `wakeDay()` matches the 10:00 templates, and the sign-up day with a wake counts, so 7 days → "1 scarecrow".
  - `shell.spec.ts`: a new account isn't `accountOldEnough`.
  - `night-plan.spec.ts` CJ-10: Out late on tomorrow's plan with a 03:30 return is accepted, since it's before that night's 06:00 cap.
- **Regression checks.**
  - `npx vitest run tests/unit` → 38 files, 250/250 passed.
  - `npm run -s lint` → 0; `tsc --noEmit` → 0.
  - Prettier check on the changed files passes.
  - i18n: en/th 672 keys each, no missing keys either way.
  - `warn-soft` / `warn` tokens exist.
