# QC Report — M9: Streaks, seasons, unlock ladder
Date: 2026-11-09 · Branch: `m9-local` → `claude/practical-cannon-a70ubq`, PR #9 · Previews: `/dev/art` (M9 section: festival decor, streak sun, scarecrow, reward decor), `/dev/farm` (sample unlocks)

**Scope.**
- **Streak** (SPEC §8.7), settled on the server into a read-only `day_results` ledger:
  - Minimum day = a live in-window "I'm up" + the Night ticket. A Perfect day also needs Day OEE ≥ 80% and pays +1 ticket.
  - A scarecrow is earned every 7 days (max 2) and used up by itself on a missed day. Vacation, Sick and a planned late night pause the streak.
  - Reaching 7, 14 or 30 days pays +5 tickets.
  - The Today streak chip opens a sheet with a 5-week calendar.
- **Seasons** (SPEC §8.8):
  - A banner every month.
  - One limited decor item in each festival month: New Year, Lunar New Year, Songkran, Mother's Day, Loy Krathong and December.
  - The harvest festival (a look back at the month) shows around each month's end.
- **Unlock ladder** (SPEC §8.8b):
  - 8 goals, counted from server facts, each paid once, with a collection book and a quiet "next unlock" line on Today.
  - Feature reveals: the Stats tab after 3 settled days, the capsule machine with the first ticket, the locked fields after the first harvest.
- **Hardening:** a finished day can't be excused afterwards (G7 R-M6-4, R-M6-R1).

## Gate results
| Gate | Result | Evidence |
|---|---|---|
| G1 Static | ✅ | `qc:static` passes: typecheck, eslint 0, prettier, i18n (672 keys EN = TH), art lint (16 art files, 55 tokens). No emoji, no hex or black in the new art |
| G2 Functional | ⏳ CI | **Unit:** 251/251. Covers the streak rules (paused late night, scarecrows, milestones, a simulated month), seasons and festival days, unlock progress (current streak), the Stats reveal age, the pinned wake-day, and SQL mirrors of content.<br>**Integration** (`streak.test.ts`):<br>• TS ⇄ SQL parity over 15+ days.<br>• Can't be faked.<br>• One test per exploit: R-M9-1, R-M9-3, R-M9-4, R-M9-5, R-M9-R1, R-M9-R2, R-M9-R3.<br>• `farm.test.ts` late-night excuse; `day-plan-patch` return time.<br>**E2E** `streak.spec.ts` CJ-M9-1..3 × 6 devices, made clock-independent.<br>**Scratch Postgres 16:** every exploit replayed; the reviewers ran 25 × 40 and 40 × 29 day parity runs with 0 mismatches. CI on the last red run (4eed46c) failed only on WebKit "internal error" at `page.goto` (runner infra); unit and integration passed there |
| G3 Visual QC | ⏳ | Self-review at 390 px, light and dark: streak chip and sheet, calendar, banner, festival sheet, collection book, decor shop. Minnie OK'd the art and the stand-in rewards ("โอเคหมด", 2026-11-04). Mac baselines still to do: `npm run e2e:update` (Today header and Farm changed) |
| G4 UX QC | ✅ (local) | Streak = 1 tap (chip → sheet). Collection = 1 tap from the Farm. Touch targets ≥ 44 px. Notices stay until OK. The calendar has a label on every cell and a legend, and "Missed" now has its own colour. Reveals fail open (nothing an existing user had disappears) |
| G5 Data & security | ✅ | **Server-only ledgers:** settle, tickets and unlocks are server-side; `day_results` / `unlock_grants` are read-only; `days_settled` / `unlock_granted` events are server-only.<br>**Past days stay closed:**<br>• Vacation/Sick and planned tags can't be added to a past day.<br>• Out late counts only if the server stamped it before that night ended, and its return time must fall on that night.<br>• Check-ins written for a finished day are backfills.<br>• Rows can't be moved to another day.<br>• The wake-day can't move backwards, through a timezone change or an edit after "I'm up".<br>**Must unlock:** counts the priority the task was paid at |
| G6 Production smoke | ⏳ | After merge + `npx supabase db push --remote` (1 migration: `20261104000000_m9_streak`). Before it, the streak chip, unlocks and reveals stay hidden or fail open, and nothing crashes. Late nights saved before the migration keep counting (grandfathered) |
| G7 Independent review | ✅ | **Review 1** (`G7-M9.md`): FAIL — 1 S1, 4 S2. Fixed test-first.<br>**Re-review 1** (`G7-M9-rereview.md`): FAIL — 2 new S2 (moving a row's date; an edit after "I'm up" moved the wake-day back). Fixed.<br>**Re-review 2** (`G7-M9-rereview-2.md`, 621423b): **PASS**. Its S3/S4s were fixed or logged |

## Rubric (self-review)
| Item | Self | Note |
|---|---|---|
| R1 Style compliance | 4 | Flat, no outlines, 2–3 tones, top-left light, flat shadow |
| R2 Consistency | 4 | Festival decor reuses the farm parts and palette |
| R3 Readability | 4 | Lantern, krathong and star tree read at 48 px; locked rewards are soft grey silhouettes |
| R4 Layout | 4 | Calendar 7 × 5 at 390 px; collection by tier |
| R5 Typography | 4 | |
| R6 Color & contrast | 4 | Light and dark checked; the missed swatch is warn-soft |
| R7 Motion | 3 | Static notices. The unlock reveal animation goes to M10 (R-M9-10) |
| R8 Delight | 4 | Scarecrows, a festival item each season, the harvest-festival look-back |
| R9 Not AI-looking | 4 | Hand-built SVG |

## G7 fixes
| ID | Sev | Description | Regression test |
|---|---|---|---|
| R-M9-1 | S1 | Out late could be set the morning after to excuse the Night ritual | integration (`{}`, "now", last night, forged stamp → refused; the day stays missed) |
| R-M9-2 | S2 | A planned late night counted as a full streak day | unit (late night → paused, missed wake still misses) + parity |
| R-M9-3 | S2 | A timezone hop reopened a finished day | integration (the wake-day never moves back; yesterday's Sick still refused) |
| R-M9-4 | S2 | Yesterday's check-ins written the next morning counted as live (Perfect day) | integration (all backfilled) |
| R-M9-5 | S2 | The Must unlock counted the task's current priority | integration (relabelled tasks don't count) |
| R-M9-R1 | S2 | Moving a row's date with UPDATE skipped every past-day rule | integration (moves refused; same-key upserts still work) |
| R-M9-R2 | S2 | An edit after "I'm up" moved the wake-day back to yesterday | integration (the wake-day stays; yesterday's Sick refused) |
| R-M9-7/8/9/11, R-M9-R2-1 | S3 | Streak goal progress used the best streak; the Stats reveal raced the settle; festival month differed between app and server; wrong "Next" season; Today ignored the pressed wake | unit + code |
| R-M9-R3/R4 | S3 | Out late return time was unbounded; existing late nights would lose their effect at deploy | integration + migration replay on a pre-M9 database |
| R-M9-12, R-M9-R2-2 | S4 | Weak tests (clock-dependent E2E, unchecked seeds, a test that no longer tested anything) | fixed |

## Known issues (S3/S4 only)
| ID | Sev | Description | Plan |
|---|---|---|---|
| R-M9-6 | S3 | Nothing paid after day 30, so restarting a streak could earn more milestone tickets than keeping it | **Fixed after merge** (Minnie OK): 7/14/30 once per account, then every 30 days (`20261109000000_streak_milestones`) |
| R-M9-10 | S3 | Unlocks show a static notice (SPEC asks for the reward animation); the streak egg hatches with no reveal | M10, with the weekly review chest |
| Out-late cap | S3 | Out late can be pre-set on many future nights. Since R-M9-2 it only pauses the streak | Accepted (Minnie: "เอาที่คิดว่าดีเลย"): a pause never adds to the streak |
| R-M9-R2-1 rest | S4 | Farm and Plan still pick "today" from the live plan (display only) | pass the pinned wake to them |
| R-M9-13, R-M9-R5, R-M9-R6, R-M9-R2-3 | S4 | >60-day gap label; items ticked after the next wake still count for OEE; sign-up freezes a 10:00 target; `-infinity` stamp shows in export | listed in DECISIONS |

## Questions for Minnie
- Out late: pause the streak (as built, matches SPEC), count it as a day, or count it at most once a week?
- Streak +5 after day 30: pay every 30 days (60, 90, …) or only the first time?
