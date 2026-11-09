# G7 re-review 2 — M9 (streaks, seasons, unlock ladder)

**Code:** worktree `/home/user/m6-wt`, branch `m9-local`, head `621423b` (fixes vs `4eed46c`). Nothing in the repo was modified.
**Method:** fresh scratch Postgres 16 on 127.0.0.1:55449 with the Supabase stub, two DBs:
- `full_db`: all 18 migrations.
- `gf_db`: migrations up to `20261103090000`, then pre-M9 seeding, then the M9 migration.

I acted as `authenticated` with `request.jwt.claim.sub`, and as `service_role` / `session_replication_role = replica` for seeding. Clock: 2026-11-09 ~17:40 Bangkok, so wake-day = Nov 9 for a 07:00 wake. The cluster has been stopped and deleted, and `/tmp/claude-0` is back to 700.

## Verdict: **PASS** — 0 × S1, 0 × S2 open

Both re-review S2s are closed, and I couldn't reopen them by any route I tried:
- **R-M9-R1:** UPDATE / upsert-on-id / ON CONFLICT … SET date / delete + re-insert / RPCs.
- **R-M9-R2:** template, plan, attending, planned push or timezone edits after a press.

Every original S1/S2 repro (R-M9-1..5) still fails. No regressions: unit tests 250/250, lint 0, tsc 0.

New findings: **0 S1 · 0 S2 · 1 S3 · 2 S4**.

| Severity | New open |
|---|---|
| S1 | 0 |
| S2 | 0 |
| S3 | 1 (R-M9-R2-1) |
| S4 | 2 (R-M9-R2-2, R-M9-R2-3) |

## Status of every earlier finding

| ID | Sev | Status | Evidence (scratch @621423b unless "by code") |
|---|---|---|---|
| R-M9-1 | S1 | **Fixed** | All of these are refused on Nov 8 / Nov 9's plans:<br>• `{}` → "needs a return time".<br>• `return_at = now()` → "must be on that night" (now caught by the new window).<br>• 02:00 on that night, the morning after → "night is already over".<br>• A direct insert with forged `late_night_set_at`, and a PostgREST upsert → refused.<br>• `"xyz"` → refused.<br>An update of `late_night_set_at = '2020-01-01'` is ignored and the server stamp is kept. Settle → `Nov 7 missed, Nov 8 missed`. |
| R-M9-2 | S2 | **Fixed** | Seeded valid / too-late stamps:<br>• Nov 6: in-window wake + Out late saved Nov 6 18:00 + no ritual → `paused`.<br>• Nov 7: ritual done → `minimum`.<br>• Nov 8: late night stamped the morning after → `missed`. |
| R-M9-3 | S2 | **Fixed** | Pago_Pago and Etc/GMT+12 → "would reopen a finished day".<br>After a press, Honolulu is allowed and correctly so: the wake-day stays Nov 9, because the Nov 9 press is already behind "now". |
| R-M9-4 | S2 | **Fixed** | 7 Nov-8 logs written with `now()` → 7/7 `backfilled`. `set_block_item` on a new block for yesterday → backfilled; for today → live. |
| R-M9-5 | S2 | **Fixed** | 10 `just_start` paid 10 each, then relabelled `must` → `paid_as just_start`. The real Musts → `paid_as must`. `claim_unlocks` gives only `first_backlog` (no `must_10`). |
| R-M9-6 | S3 | Deferred — acceptable | Economy call for Minnie, no integrity risk. It must be in the M9 report / BUILD_PLAN deferred list. |
| R-M9-7, -8, -9, -11, -12 | S3/S4 | Fixed (re-review 1) | Untouched by `621423b`. |
| R-M9-10 | S3 | Deferred to M10 — acceptable | Must be listed in the M9 report. |
| R-M9-13 | S4 | Deferred — acceptable | Now listed in DECISIONS (">60-day gap" label). |
| **R-M9-R1** | **S2** | **Fixed** | `day_keys_guard` (`m9_streak.sql:36-54`). Each of these is refused with "a day can't be moved":<br>• `update day_plans set date` (future Sick → past).<br>• `update block_logs set date` (today → yesterday).<br>• `set block`.<br>• `set user_id`.<br>• PostgREST-style `insert … on conflict (id) do update set date = excluded.date` on both tables.<br>• Raw `on conflict (user_id,date) do update set date = …`.<br>The workarounds also fail:<br>• Delete + re-insert of a Sick plan on Nov 7 → "Vacation/Sick can't be set for a past day". An upsert switching it to vacation → same.<br>• Delete + re-insert of today's 7 logs as Nov 8 → 7/7 backfilled.<br>• A planned tag on a new past log, by insert or by upsert → refused.<br>`patch_day_plan` and `set_block_item` never change keys (they're the only RPC writers, by grep). Upserts on the natural keys (every client write, by grep) still work, including the test's `items_planned` upsert. `ON DELETE SET NULL` on `template_id` doesn't change the keys either. |
| **R-M9-R2** | **S2** | **Fixed** | `_wake_day` reads `wake_events` first (`m9_streak.sql:9-31`). User a5 pressed on Nov 9, out of window, with no snapshot. Then:<br>• Every template → 23:30.<br>• `patch_day_plan` with `attending:false` and a planned push to 23:59.<br>Wake-day stays **Nov 9** after each. Sick on Nov 8 → refused, Nov 8 logs → backfilled, planned tag → refused, settle → `Nov 6–8 minimum`, no Perfect.<br>**Early press is unchanged:** target = now + 60 min, press → `in_window = t`, and the wake-day stays Nov 8 until the target. Today's log stays live. Moving the template earlier or later after the press doesn't move the wake-day; the pressed target wins.<br>Backfilled wake rows can't affect it: `backfill_wake` only takes dates < calendar today, and `_wake_day` only reads calendar today. Clients can't write `wake_events` (no insert/update/delete policy). |
| R-M9-R3 | S3 | **Fixed (binding); count cap deferred — acceptable** | The return time must be in [D−1 12:00, D 12:00) local:<br>• 2099 → refused.<br>• Boundaries: D−1 12:00 ✓, D 11:59 ✓, D−1 11:59 ✗, D 12:00 ✗.<br>• Tonight with a 23:00 return ✓.<br>This matches the client exactly (`DayEditor.tsx:111-116`: before noon = D, else D−1).<br>Pre-setting Out late on many future nights is still possible. Since R-M9-2 that is only a pause, and DECISIONS leaves the cap to Minnie, so it's OK as a known S3 for the M9 report. |
| R-M9-R4 | S3 | **Fixed** | `gf_db`: pre-M9 rows (Nov 7 / Nov 8 `{}` / Nov 10 none / Nov 12) all read `-infinity` (`atthasmissing = t`, no default left).<br>**Farm:** a Free plot whose Nov 6 miss was excused by the Nov 7 Out late is ripe before and after the migration, and `harvest_plot('free')` succeeds.<br>**Settle:** Nov 7 → `paused` from the grandfathered `{}` row, as DECISIONS intends.<br>**After the migration:**<br>• Touching a grandfathered row without changing `late_night` keeps `-infinity`.<br>• Changing it re-validates and re-stamps `now()`.<br>• A new row without a late night stays null. |
| R-M9-R5 | S4 | Accepted as designed — acceptable | Listed in DECISIONS. |
| R-M9-R6 | S4 | Deferred — acceptable | It predates M9, and the new `_wake_day` makes it matter less (a pressed day ignores the bad snapshot). |

## New findings

| ID | Sev | Finding | Where | Repro | Suggested fix |
|---|---|---|---|---|---|
| **R-M9-R2-1** | S3 | **Today can disagree with the server about the wake-day after a press.** The client's `currentDayDate` uses only the live plan (`planFor(ctx, d0).wake`). It ignores the pressed wake and the frozen snapshot, which the server now honours first.<br>**Example:** press "I'm up" at 07:05, then at 08:00 move today's kind of day to 09:00 (say, for future weeks).<br>• Until 09:00, Today shows **yesterday's** day. The server says today.<br>• Check-ins tapped in that window are written to yesterday and get `backfilled` (no live credit for OEE, farm or unlocks).<br>• Vacation/Sick from the ⋯ menu targets yesterday and is refused.<br>The same divergence already existed for frozen (snapshot) days. The fix makes the server correct and extends the divergence to pressed days. It under-counts and never over-pays, and the trigger is an uncommon flow, hence S3. | `lib/today/day.ts:155-158`; `lib/today/useToday.ts:228` (`wakes`/`frozen` are already loaded at :105-117 but not passed) | **Server side, scratch (a5 / e1):** after a press plus a later or earlier template edit, `settle_days().today` keeps the pressed day.<br>**Client side, by code:** `currentDayDate` → `now < planFor(d0).wake` → yesterday. | Mirror `_wake_day`: `currentDayDate(ctx, now, wakes, frozen)` with `target = wakes[d0]?.target_wake ?? frozen[d0] ?? planFor(ctx, d0).wake`. Use it in useToday, usePlan and useFarm.<br>**Unit test:** "pressed at 07:05, template moved to 09:00 → still today". |
| **R-M9-R2-2** | S4 | **An integration test became vacuous with the new return-time window.** In `day-plan-patch.test` "clearing a field works (null)…", the setup `late_night: { return_at: now }` on today+3 is now refused ("must be on that night"). The test doesn't check that error, so the "clear it" part passes without ever setting a late night.<br>Related: in `streak.test` R-M9-1 ("return time now on today's plan"), after local noon the refusal comes from the window, so the "night is already over" path is only exercised before noon. | `tests/integration/day-plan-patch.test.ts:39-45`; `tests/integration/streak.test.ts:196-212` | Scratch: `patch_day_plan('2026-11-12', {late_night:{return_at: now()}})` → ERROR; `late_night` stays null. | Use `zonedInstant(date, 2*60, TZ)` and `expect(error).toBeNull()` before clearing. In the R-M9-1 test, also try a return time on that night (e.g. `zonedInstant(today, 60)`) so the "night over" refusal is hit at any hour. |
| **R-M9-R2-3** | S4 | **Grandfathering stamps every pre-M9 `day_plans` row**, including the many with no late night, with `late_night_set_at = -infinity`. It's harmless to the logic (a stamp without a late night means nothing, and setting one later re-stamps). However, "Export all data" (SPEC §10, which exports `day_plans` as is) will show `-infinity` in that column for all old rows. | `supabase/migrations/20261104000000_m9_streak.sql:185-186` | `gf_db`: the Nov 10 row with no late night reads `-infinity`. | Optional:<br>• Grandfather only rows with a late night, e.g. add the column with no default, then run `update … set late_night_set_at = '-infinity' where late_night is not null` with `session_replication_role = replica`.<br>• Or accept it and note it in DECISIONS. |

## Other bypass ideas tried (none worked)
- **Service-role bypass:** `day_keys_guard` is not `security definer`, so `current_user` is the caller. Inside `patch_day_plan` (owner postgres), `current_setting('role')` is still `authenticated`. Users can't `SET ROLE service_role`.
- **Trigger order:** `block_logs_guard` / `block_logs_planned_guard` run before `day_keys_guard`, `day_plans_past_guard` runs after it. A key change is refused either way, because the exception aborts the row.
- **Past `template_id` / `planned` edits:** these can still change a past day's live target. `_night_over_at` prefers press → snapshot, and is capped at 06:00. The late-night stamp was validated when it was set, so such an edit can only invalidate a stamp (which hurts the user), never validate one.
- **Unlocking a past day with timezone hops after a press:** blocked by the R-M9-3 guard. With a press, the wake-day is pinned by `wake_events`.
- **Pre-M9 forged late nights (old R-M9-1 bug):** they keep counting under grandfathering, by design (DECISIONS). After R-M9-2 they're worth a pause only.

## Deferrals — judgement
All are acceptable:
- R-M9-6, R-M9-10, the R-M9-R3 count cap (S3).
- R-M9-R5, R-M9-R6, R-M9-13, festival tz, capped completions, client farm preview (S4).

Condition: when M9 closes, list each one in `docs/qa/M9-report.md` and in the BUILD_PLAN M9 status (neither exists yet), as CLAUDE.md requires.

## What I verified and how

### Cluster setup
- PG16 on port 55449, with `stub.sql` (`stub2.sql` for the second DB). Migrations were piped through stdin, because `/tmp/claude-0` kept being reset to 700.
- Helper schema `qa`: `mk` / `wake` / `night` / `res`. `mk` clears the sign-up snapshots.

### Scripts
All are in `scratchpad/g7r9b/`.
- **`a_orig.sql`:** the R-M9-1 forgeries, then settle.
- **`b_move.sql`:** R-M9-3 / R-M9-4 originals, then every R-M9-R1 key-move vector:
  - UPDATE of `date`, `block`, `user_id`.
  - Upsert on `id`.
  - `ON CONFLICT … SET date`.
  - Delete + re-insert of plans and logs.
  - Planned tag by insert or upsert.
  - Then settle: no grants.
- **`c_r2.sql`:** R-M9-R2 after a real `press_wake` (template, attending and planned-push edits, then the past-day guards and settle), plus the early-press scenario with template edits in both directions.
- **`d_tests.sql`:** replays of the integration tests. Covers `day-plan-patch` (Sick upsert + merge; the vacuous late-night clear), the `streak.test` R-M9-R1 / R-M9-R3 shapes, the return-window boundaries, `set_block_item` on yesterday and today, and account deletion with plans.
- **`e_misc.sql` / `f_r2.sql`:** R-M9-5 and R-M9-2.
- **`gf_pre.sql` / `gf_post.sql`:** the R-M9-R4 grandfathering across the migration, with farm ripeness, harvest, settle and post-migration stamping.

### Integration tests (by code, against the new SQL)
- **streak.test:**
  - The parity and "can't be faked" seeds go through admin, so the guards are bypassed and the stamps are explicit.
  - The R-M9-1 / R-M9-3 / R-M9-4 / R-M9-5 expectations hold.
  - The new R-M9-R1 / R-M9-R2 / R-M9-R3 tests match the scratch behaviour. The R2 test would fail on `4eed46c` except in the 23:30–24:00 window and on days covered by the R-M9-R6 snapshot.
- **farm.test:** late nights are seeded by admin with explicit stamps.
- **wake.test / wake-freeze.test:** none of them presses and then moves the target later, or relies on `_wake_day` after a press. The live / backfill guard test writes today's date, so it's unaffected.
- **rereview / rereview2:** no key changes. Future-dated `patch_day_plan` calls are fine. Account deletion cascades with no UPDATE (verified on scratch).
- **review-m123 / night / rls:** these don't touch the changed paths. The rls user-move test uses `backlog_items`, so its `42501` expectation is unaffected by `day_keys_guard`'s 22023.
- **day-plan-patch:** see R-M9-R2-2.

### E2E (by code)
- `night-plan.spec` CJ-10 enters "Home at 03:30" on tomorrow's plan. The client maps that to D 03:30, which is inside the window.
- `night-plan` R-M4-3 and `farm.spec` seed `block_logs` with the service key.
- `streak.spec` seeds `wake_events` only for past days, so its `wakeDay()` still matches.
- No client code updates `date` or `block`. Every write is an upsert on `user_id,date[,block]` or goes through an RPC.

### Regression checks
- `npx vitest run tests/unit` → 38 files, 250/250 passed.
- `npm run -s lint` → exit 0; `npx tsc --noEmit` → exit 0.
- `prettier --check` passes on `streak.test.ts` and `DECISIONS.md`.

### Not re-run
The 40-user TS⇄SQL parity run. The `settle_days` body is unchanged in `621423b`; the diff only touches `_wake_day`, the new key guard, the column default, the return window and one revoke.

### Incident
At 10:43:46 UTC, the main session's cluster on port 55445 (`scratchpad/pg9/data`) crashed. Its checkpointer aborted because `/tmp/claude-0` was reset to 700 externally, then it shut down on "could not stat data directory". Its data directory is intact, and I didn't touch it. My cluster (55449) survived, and I stopped and deleted it at the end. `/tmp/claude-0` is now 700.
