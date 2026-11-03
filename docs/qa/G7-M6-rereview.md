# G7 re-review — M6 fixes (commit 1e5b4ba; HEAD 737e35f is docs only)
Read-only. Nothing in the repo was changed (`git status` is clean). `/tmp/claude-0` is back to 700.

## Verdict: **PASS** (0 S1, 0 S2 open)

All three S2s are fixed and verified. The fixes add one S3 and a few S4s (below).

### R-M6-1 (S2), future-dated check-ins → **FIXED**
Scratch PG16, all 14 migrations, run as `authenticated`.

**Refused with 22023 "a check-in can't be for a future day":**
- direct insert dated 2026-11-04 (today is 11-03 in Bangkok)
- `set_block_item('2026-11-04', …)`
- an UPDATE that moves a row to 2026-11-09

**App write paths still work:**
- `set_block_item` for today (11-03) and yesterday (11-02) succeeds with `backfilled=f`.
- The service role can still write a future row, as test setup needs.
- **After midnight, before wake:** the app's wake-day (`currentDayDate`) is the calendar date or the day before, never later. It uses the same profile timezone as the guard. A planned wake up to −6 h only moves the wake time; `currentDayDate` still compares against `planFor(d0)` on the calendar date. So every log the app writes (Today upsert, `set_block_item`, the ritual's mark-missed) is dated ≤ the server's local today and passes the guard.

### R-M6-2 (S2), planned late night → **FIXED**
The TS rule (`blockResult` with `day.excused` + `buildDayFacts.lateNights`, where `late_night` on D excuses Free on D−1) and the SQL mirror in `_plot_ripe` (`r in ('miss','partial')`, slot `free`, `late_night` on d+1) map every case the same way:

| Free on that day | Result (TS and SQL) |
|---|---|
| has a miss_reason | excused |
| skipped (no log) | excused |
| started late (partial) | excused |
| backfilled | stays backfilled |
| success | stays success (still grows) |
| today (open) | stays open |

**Parity fuzz re-run with random late nights** (30% of days), on top of modes, wakes, Night grants, every block-log kind and regrow:
- 2 seeds × 400 users × 7 plots × 13 days = **72,800 (plot, day) comparisons, 0 mismatches**
- Control run (TS without `lateNights`): 138 mismatches, so the late-night path really is exercised.

### R-M6-3 (S2), Night ritual planting → **FIXED**
- `components/farm/PlantAll.tsx` sits in ritual step 3. One tap on a seed picture plants it in every empty plot, using one `plant_seed` RPC per plot. Planting at ritual time gives `planted_on` = the wake-day, so growth counts from tomorrow.
- i18n EN/TH ✓, aria-label per seed ✓, buttons are `min-h-11` ✓. Partial failures show an error.
- E2E covers it as "CJ-07 step 3".
- The decision is logged in DECISIONS.

## New / remaining findings
| ID | Sev | Finding | Where | Repro |
|---|---|---|---|---|
| R-M6-R1 | S3 | A late night excuses a Free that is already over. During the Night ritual (step 3, DayEditor for tomorrow: "Out late tonight"), Free has already ended. Setting any return time there, even one in the past, turns that skipped Free from a miss (weeds) into excused. SPEC §0.3 says "a late night planned **in advance**". The server doesn't check when `late_night` was set, and the API also accepts it on past dates. | `supabase/migrations/20261103060000_m6_farm.sql` (`_plot_ripe` late-night check); `components/plan/DayEditor.tsx:73-79` | Skip Free on D, then at 23:00 open the Night ritual and set Out late with return 23:30: D's Free is excused. Fix idea: a server stamp like `wake_planned_at`, and only honour a `late_night` saved before Free's planned start. Belongs with R-M6-4 (client-written inputs) before M7. |
| R-M6-R2 | S4 | A timezone switch still lets a client pre-write tomorrow. `profiles.timezone` is client-editable, and the guard uses it. From Bangkok 17:00 (UTC 10:00) on, switching to `Pacific/Kiritimati` (+14) makes "today" D+1. You can insert D+1 logs as live, then switch back. It can only reach one day ahead, so it adds nothing beyond the known ability to forge today's log (R-M6-4). | guard (`today` in the profile tz) | `update profiles set timezone='Pacific/Kiritimati'` is accepted (verified). Then insert a D+1 log in the evening. |
| R-M6-R3 | S4 | After a westward timezone change during the day, the server's "today" can be earlier than rows already logged. Updating today's log then fails with "future day". | guard | In Bangkok after wake on Nov 4, set the timezone to America/Los_Angeles (Nov 3 there), then tick an item on the Nov 4 block: error. |
| R-M6-R4 | S4 | Parity on odd `late_night` values. TS uses truthiness; SQL uses `is not null`. A client-crafted jsonb `false`, `0` or `""` gives excused in SQL but not in TS. `patch_day_plan` already turns JSON null into NULL, so the app itself never hits this. | `lib/farm/useFarm.ts:100`; SQL :139 | Direct `update day_plans set late_night='false'`. |
| R-M6-R5 | S4 | PlantAll shows nothing at all while loading or if the plots read fails. There is no loading or error state (QA_QC §5). It also plants one crop in all plots, with no per-plot choice (logged as a decision). | `components/farm/PlantAll.tsx:42` | Go offline, then open step 3: no seed section, no message. |

The S3/S4 items from the first review (R-M6-4..16) are unchanged and still open as known issues.

## What I ran
- `npx vitest run tests/unit`: 198/198 pass.
- `npx eslint .`: clean.
- art lint: OK.
- `npm run i18n:check`: 468 keys EN = TH.
- `tsc`: only `LayoutProps` errors (needs `next typegen`, which `npm run typecheck` runs first), so nothing from M6.
- Scratch PG16:
  - guard checks for direct insert, RPC and update
  - today and yesterday live writes
  - timezone edit
  - late_night on a past date
  - service-role write
  - parity fuzz with late nights (above)
- The DB was stopped and deleted afterwards.
- Integration and E2E suites were not run here (CI runs them).
