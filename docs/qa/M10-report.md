# QC Report — M10: Stats + weekly review (+ first-time tips)
Date: 2026-11-10 · Branch `m10-local` → `claude/practical-cannon-a70ubq`, PR #10 (this PR also carries the M9 follow-up: streak milestones once per account, then every 30 days) · Preview: `/dev/stats?review=open|done|none`

**Scope**
- **Stats (SPEC §7)**, over the last 28 finished days but never before sign-up:
  - Day OEE bars with the 80% line.
  - Wake-time I-MR chart: σ = MR̄/1.128, ±3σ, weekday and weekend separately, out-of-control points flagged.
  - Sleep regularity: 7-day SD of bedtime and wake time, plus drift.
  - Streak calendar.
  - Block × weekday heatmap.
  - Miss-reason Pareto.
  - Home vs out.
- **Weekly review:**
  - Opens on the week's Sunday, with Monday as a grace day.
  - Shows the week summary, then asks for Keep / Problem / Try.
  - Pays +3 tickets once per week (server-side ledger).
  - Today shows a quiet line while it's open.
- **First-time tips (Minnie):**
  - 8 one-time bubbles, one at a time.
  - "Got it" or "Skip all tips"; a tap outside also closes them.
  - Kept per account; More has "Show tips again".
  - Existing accounts start with every tip marked seen.

## Gate results
| Gate | Result | Evidence |
|---|---|---|
| G1 Static | ✅ | `tsc` 0 (the known Next `LayoutProps` noise only) · eslint 0 · prettier clean · i18n 746 keys EN = TH · no emoji |
| G2 Functional | ⏳ CI blocked | **Unit:** 268/268. Covers stats math (hand-checked I-MR, regularity, heatmap, Pareto, home/out, week summary, sign-up window, used blocks), the tips picker, the tips migration mirror, the streak milestone rule including 90-day and restart cycles, and SQL mirrors.<br>**Integration:** `weekly-review.test.ts` (once per week, closed days, new accounts, blanks, no client writes) and the streak parity tests.<br>**E2E:** `stats.spec.ts` CJ-M10-1 and `tips.spec.ts` CJ-M10-2, × 6 devices.<br>**Scratch Postgres 16 (UTF8):** every migration applies. Verified: review window and payout, column grants, the tips constraint, Unicode blanks, and milestone parity (by the reviewer).<br>**CI:** cannot run while GitHub Actions minutes are used up. |
| G3 Visual | ⏳ | `/dev/stats` screenshots at 390 px: EN light and TH dark, sent to Minnie. Mac baselines for Today, Plan and Stats need re-recording after merge. |
| G4 UX | ✅ (local) | 44 px targets. Every chart has a sentence label, and the heatmap is a real table with cell labels. Reviewing takes 3 fields and one tap. Tips never stack, never show during onboarding or under a sheet, and respect reduced motion. |
| G5 Data & security | ✅ | **Reviews:** written only through `submit_weekly_review`; a read-only table; +3 through `_grant_once`, idempotent under races.<br>**Review rules:** the review week requires the account to have existed from that week's Thursday, judged by UTC sign-up date. Blank answers are refused, including Unicode blanks.<br>**Profiles:** clients may UPDATE only display_name, timezone, locale, sound_on, onboarding, tips_seen and tips_off. `tips_seen` is limited to the known tip ids.<br>**Events:** server-only types are still blocked for clients. |
| G6 Prod smoke | ⏳ | After merge + `npx supabase db push --remote`. 2 migrations: `20261109000000_streak_milestones`, `20261110000000_m10_weekly_review`. |
| G7 Independent review | ⏳ | **Review 1** (`G7-M10.md`): FAIL — S2 R-M10-1, Stats counted days before sign-up. Fixed test-first.<br>**Re-review 1** (`G7-M10-rereview.md`): FAIL — S2 R-M10-R1, a scroll closed tips. Fixed, along with R-M10-R2..R7.<br>Re-review 2 is next. |

## Rubric (self-review)
| Item | Self | Note |
|---|---|---|
| R1 Style | 4 | Tokens only, pastel, flat bars; one primary colour plus warn for flags |
| R2 Consistency | 4 | Cards, radii and segmented control match the rest of the app |
| R3 Readability | 4 | Every chart has a one-line takeaway above it (e.g. "Usually 07:38 · ±20 min") |
| R4 Layout | 4 | Fits 390 px (axis labels fixed); EN and TH checked |
| R5 Typography | 4 | |
| R6 Colour & contrast | 4 | Light and dark checked; the heatmap mixes primary into surface |
| R7 Motion | 4 | Charts don't animate; the tip fade turns off with reduced motion |
| R8 Delight | 3 | Review payout notice with a ticket; the reward chest animation is deferred (R-M9-10) |
| R9 Not AI-looking | 4 | |

## Known issues (S3/S4 only)
| ID | Sev | Description | Plan |
|---|---|---|---|
| Sleep / Perfect day | S3 (since M3) | Sleep has no check-in on Today, but Day OEE counts all 7 blocks, so a day tops out near 73% and a Perfect day is nearly unreachable | Minnie decides: the Night ritual starts Sleep (proposed), or Sleep leaves Day OEE |
| R-M9-10 | S3 | No reward animation for unlocks, and no hatch reveal for the streak egg | M14 (listed in its prompt) |
| G3 / G4 | — | Retention dashboard and weekly share card | M14 (listed) |
| R-M10-15 | S4 | On Sunday the week summary covers Mon–Sat (Sunday isn't finished yet) | accepted |
| R-M10-14 | S4 | The grandfather update bumps every profile's `updated_at` | accepted, harmless |
| others | S4 | see `G7-M10*.md` | polish |

## Questions for Minnie
- Stats screenshots OK?
- Sleep: start it from the Night ritual's last step?
- GitHub Actions minutes: wait for the reset, set a small budget, or make the repo public?
