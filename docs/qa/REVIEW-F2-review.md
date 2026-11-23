# G7 independent review: Phase F part 2 (F4 "Som follows the day", F5 milestone scenes)

Scope: commits 40d4b4f, b495955. Reviewer: independent QA (read-only), 2026-11-23.

**Verdict: PASS** (no open S1/S2; 4 × S3, 4 × S4 below)

## Checks run
- `npx tsc --noEmit -p .`: clean. ESLint on all changed files: clean (0 warnings).
- `npx vitest run` (unit + integration, local Supabase): 746/747 passed on the first run. `market.test.ts` timed out at 5 s while the parallel E2E run was loading the server; on a re-run it passed, together with `milestone-beats`, `director` and `mark-for` (30/30). `story.test.ts` "gifts mirror content" loops over all `STORY_BEATS`, including the 4 new ones, and passes.
- `scripts/i18n-check.ts`: 1312 keys, en = th. `scripts/qc-art-lint.ts`: OK.
- DB (live): the new `_story_facts` and `_story_ready` are applied. Both are `security definer` with `search_path=""`. Their ACLs are unchanged (postgres and service_role only; no anon or authenticated). `create or replace` keeps the grants.

## What holds
- **Migration copies the previous code exactly.** I diffed it against the latest earlier definitions (`20261113140000_story_chapters.sql`; no later migration redefines either function). The only changes are the 3 new facts and the 4 new `when` cases. Nothing earlier is lost.
- **Users can't fake the new facts:**
  - `events` insert policy (last redefined in `20261114000000_factory.sql:44`) blocks `jobs_collected`, and `factory.test.ts:199` tests this.
  - `ticket_grants` and `game_state` have force-RLS with only a select policy.
  - `day_results` grants authenticated users select only.
  - `welcome_back` grants come only from `claim_welcome_back`. `jobs_collected` comes only from `collect_jobs`, which writes it only when n > 0.
- **Client and SQL triggers match:** perfect_days ≥ 1, best_streak ≥ 30, made ≥ 1, welcome_backs ≥ 1, read from the same sources. `_story_gift` has no case for the new beats, so it returns null.
- **Director:** the new beats have rank 2 (chapters 7, 8, 10, 11). They never get ahead of chapters 0–2 or the month-only seasonal beats. "One beat a day" is unchanged on both client and server. Seasonal `*_use` beats sit behind up to 4 more beats, but their season-year lasts 12 months, so nothing is lost.
- **F4:**
  - The `markFor` mapping matches the plan.
  - The dusk sky uses only tokens (`--sky-dusk-*`), and the gradient is only on the sky.
  - The icon `<svg>` is `aria-hidden`, and the wrapper span has no role, so it is decorative.
  - At 390 px there is about 150 px left for the title and subtitle beside the chip and menu. The subtitle wraps, so there is no overflow.
  - The `ScreenHeader` wrapper doesn't change the other 13 headers.
- **Tests:**
  - The integration test proves the order: refused before the milestone, granted, then refused once `seen` is aged (already seen), with tickets unchanged.
  - The E2E marks this season-year's seasonal beats seen for any month and uses `wakeDay()` with 10:00 templates, so it doesn't depend on the month or the time of day.

## Findings

**S3-1: the ch7 text says "today" and "tonight", but the scene can only play on a later day.**
- Where: `messages/en.json:1321-1322`, and the same lines in `messages/th.json`.
- What happens: `day_results` rows are written by `settle_days` only for days that have ended (`while d < today`, `20261109000000_streak_milestones.sql`). So the earliest the scene can play is the next wake-day.
- "Every block today, start to finish" also overstates the rule. A perfect day is a minimum day plus a Day score of at least 80% (`rulePerfect`).
- Fix: use past tense and rule-true wording, e.g. "Yesterday went to plan, almost to the minute. Som noticed." / "เมื่อวานเป็นไปตามแผนเกือบทั้งวัน ส้มเห็นนะ". Rework l2 ("tonight") the same way.

**S3-2: ch11 "Welcome back" is not tied to a recent welcome back, so it can play late or out of context.**
- Where: `20261123000000_milestone_beats.sql:76`, `content/story.ts` (ch11), `lib/game/director.ts:84`.
- What happens: the trigger is "ever claimed a welcome back", and the beat ranks last in rank 2. That causes two problems:
  - After deploy, accounts that claimed a welcome back weeks ago get "Som kept the gate warm while you were away… Just one small thing today" while they are using the app every day.
  - A return in a seasonal month, or with ch7/ch8/ch10 queued, pushes it back by days.
- Fix:
  - Trigger: a welcome back in the last 7 days. On the server, `public._welcome_ref(uid, d) is not null`; on the client, a matching fact.
  - Order: rank it ahead of the other rank-2 chapters, so it plays the day of the welcome card, as the plan pairs them.
  - Add a director test and an integration test for this.

**S3-3: the TH story lines address the user differently from every earlier beat.**
- Where: `messages/th.json`, in ch8 l2, ch10 l2 and ch11 l1/l3.
- What happens: all earlier story lines say "คุณ" (ch0, ch1, ch2, ch5, ch6, lotus, snow). The new lines use "เรา", which in narration reads as "we/us":
  - "ส้มภูมิใจในตัวเรามาก" reads as "Som is proud of us".
  - "ตอนเราไม่อยู่" is ambiguous.
- Fix:
  - "เช้าของคุณครบทั้งเดือน"
  - "ทำจากผลผลิตของคุณเอง ส้มภูมิใจในตัวคุณมาก"
  - "ตอนคุณไม่อยู่ ส้มเฝ้าประตูรอไว้ให้"
  - "ฟาร์มดีใจที่คุณกลับมา"

**S3-4: F4 is missing the checks the plan asks for.**
- Where: `app/dev/art/page.tsx:39`.
- What happens:
  - The dusk icon is not in the `/dev/art` gallery, which still lists only sunrise, meadow and night. The plan's test for F4 is "each new piece on /dev/art; a look at 48 px and 160 px in light and dark".
  - Only `markFor` has a test. No E2E checks the header mark, or that the page doesn't scroll sideways with mark + chip + menu at 390 px.
- Fix: add "dusk" to the gallery. In an existing Today E2E, assert `[data-mark="meadow"]` at the calm afternoon clock, plus `expectNoHorizontalScroll`, in EN and TH.

**S4-1: Som may be hard to see against the dusk sun.**
- Where: `components/art/AppIcon.tsx:42`.
- What happens: the dusk sun is `--art-orange-light`, which is exactly Som's fur highlight (`FUR = TONES.orange`) and close to the fur base `#f5a86b`. Contrast is about 1.3:1, against about 1.47:1 for sunrise. With no outlines, the head may blur into the disc at 44 to 48 px.
- Fix: look at it at 44 px, and consider a peach, pink or red-light disc instead.

**S4-2: two scenes share the title "Thirty days".**
- Where: `messages/en.json` and `th.json`, `story.ch8_thirty_days.title`.
- What happens: it is the same as `ch6_album.title` ("Thirty days" / "สามสิบวัน"). Both scenes use the album, and both dialogs get the same accessible name.
- Fix: e.g. "A month in a row" / "ติดกันครบเดือน".

**S4-3: the integration refusals don't show which rule refused.**
- Where: `tests/integration/milestone-beats.test.ts:18,25`.
- What happens: the test asserts only the code `P0001`, which "not yet", "already seen" and "one beat a day" all use.
- Fix: also assert the message ("not yet", then "already seen"). Optionally add a user-client forgery attempt here for each fact source (a `welcome_back` ticket_grants insert, a day_results insert), even though these are covered elsewhere.

**S4-4: the "made" comment says batches, but the fact counts collect calls.**
- Where: `content/story.ts` (the `made` comment).
- What happens: the fact counts `jobs_collected` events, one per collect call that took anything, not batches. This makes no difference while `need` is 1.
- Fix: change the comment to "collects that took at least one product".
