# QC Report — M10: Stats + weekly review (+ first-time tips)
Date: 2026-11-10 · Branch `m10-local` → `claude/practical-cannon-a70ubq`, PR #10 (this PR also carries the M9 follow-up: streak milestones once per account, then every 30 days) · Preview: `/dev/stats?review=open|done|none`

**Scope**
- **Stats (SPEC §7)**, over the last 28 finished days but never before sign-up. Redesigned after Minnie's review (2026-11-10): three tabs (Overview / Sleep / Days), plain words ("Day score", no "OEE"), IG-insights-style headline numbers:
  - Day score (shown in plain words, no "OEE"): the last 7 days, vs the 7 before, with the 80% line.
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
- **Sleep gets a check-in** (Minnie OK, 2026-11-10). It used to top out near 73%, so a Perfect day was out of reach; now it's reachable again.
  - Goodnight starts Sleep and ticks its first-10 when bedtime is close (≤ 10 min).
  - Otherwise Today shows "Going to bed" from 30 min before bedtime.
- **First-time tips (Minnie):**
  - 8 one-time bubbles, one at a time.
  - "Got it" or "Skip all tips"; a tap outside also closes them.
  - Kept per account; More has "Show tips again".
  - Existing accounts start with every tip marked seen.

## Gate results
| Gate | Result | Evidence |
|---|---|---|
| G1 Static | ✅ | `tsc` 0 (the known Next `LayoutProps` noise only) · eslint 0 · prettier clean · i18n 771 keys EN = TH · no emoji |
| G2 Functional | ⏳ CI blocked | **Unit:** 279/279. Covers stats math (hand-checked I-MR, regularity, heatmap, Pareto, home/out, week summary, sign-up window, used blocks), the tips picker, the tips migration mirror, the streak milestone rule including 90-day and restart cycles, and SQL mirrors.<br>**Integration:** `weekly-review.test.ts` (once per week, closed days, new accounts, blanks, no client writes) and the streak parity tests.<br>**E2E:** `stats.spec.ts` CJ-M10-1 and `tips.spec.ts` CJ-M10-2, × 6 devices.<br>**Scratch Postgres 16 (UTF8):** every migration applies. Verified there: review window and payout, column grants, the tips constraint, Unicode blanks. Re-review 2 independently re-checked the grants and the constraint. Milestone parity was checked by review 1. The re-review 1 fixes (d1f47b1) shipped without tests; those tests were added afterwards (R-M10-R2-1): the created_at write refused, a timezone switch, the window's worst block, drift over gaps, and the constraint's id list.<br>**CI:** cannot run while GitHub Actions minutes are used up. |
| G3 Visual | ⏳ | `/dev/stats?tab=overview|sleep|days` screenshots at 390 px after the redesign: EN light and TH dark, sent to Minnie. Mac baselines for Today, Plan and Stats need re-recording after merge. |
| G4 UX | ✅ (local) | 44 px targets. Every chart has a sentence label, and the heatmap is a real table with cell labels. Reviewing takes 3 fields and one tap. Tips never stack, never show during onboarding or under a sheet, and respect reduced motion. |
| G5 Data & security | ✅ | **Reviews:** written only through `submit_weekly_review`; a read-only table; +3 through `_grant_once`, idempotent under races.<br>**Review rules:** the review week requires the account to have existed from that week's Thursday, judged by UTC sign-up date. Blank answers are refused, including Unicode blanks.<br>**Profiles:** clients may UPDATE only display_name, timezone, locale, sound_on, onboarding, tips_seen and tips_off. `tips_seen` is limited to the known tip ids.<br>**Events:** server-only types are still blocked for clients. |
| G6 Prod smoke | ✅ | `npm run qc:prod` on prod, 2026-11-10 (Minnie, after `db push` of every v1 migration): 22/22 passed on iphone + chrome-desktop, Lighthouse assertions passed. Tests that need their own user skip on prod, by design. Covers smoke (login → today → check-in → farm), every screen with no raw keys or horizontal scroll (EN/TH, light/dark), CJ-17 export, PWA manifest + service worker |
| G7 Independent review | ⏳ | **Review 1** (`G7-M10.md`): FAIL — S2 R-M10-1, Stats counted days before sign-up. Fixed test-first.<br>**Re-review 1** (`G7-M10-rereview.md`): FAIL — S2 R-M10-R1, a scroll closed tips. Fixed, along with R-M10-R2..R7.<br>**Re-review 2** (`G7-M10-rereview-2.md`, f42d443): **PASS**. Its S3s were fixed or logged (below).<br>**Re-review 3** (`G7-M10-rereview-3.md`, d95d29b; covers the Stats redesign, Goodnight → Sleep and the 48 h window): **PASS**. Fixed: R3-1 (early Goodnight leaves Sleep for "Going to bed"), R3-2 (blocks judged from their first check-in), R3-3/4/5/10/11 (labels, bars, help, points, nits), R3-7 (bedtime rules unit-tested), R3-8 (event). Logged: R3-6, R3-9. |

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
| R-M9-10 | S3 | No reward animation for unlocks, and no hatch reveal for the streak egg | M14 (listed in its prompt) |
| G3 / G4 | — | Retention dashboard and weekly share card | M14 (listed) |
| R-M10-R3-6 | S3 | Sleep checklist items (none by default) count once Sleep starts, and only Today's card or the day list lets you tick them | revisit if people add Sleep items (playtest) |
| R-M10-R3-9 | S4 | If step 3 moves tonight's bedtime and Goodnight lands within 10 min of the old one, Sleep keeps the old planned start | rare; accepted |
| R-M10-R2-2 | S3 | A tap outside also marks a tip seen when the tip is scrolled off-screen | only count it when the bubble is at least half visible; check in the playtest pilot |
| iOS click | — | iOS may not fire `click` on plain text, so "tap outside" may only work on controls (it errs toward keeping the tip) | check on a real iPhone in the pilot |
| R-M10-R2-5 / R2-7 | S4 | UTC cut-off shifts by the user's offset; the streak tip's arrow points at the title | accepted / polish |
| R-M10-15 | S4 | On Sunday the week summary covers Mon–Sat (Sunday isn't finished yet) | accepted |
| R-M10-14 | S4 | The grandfather update bumps every profile's `updated_at` | accepted, harmless |
| others | S4 | see `G7-M10*.md` | polish |

## Questions for Minnie
- Answered 2026-11-10: Stats redesign OK; Goodnight starts Sleep; the repo goes public for a while so CI can run.
