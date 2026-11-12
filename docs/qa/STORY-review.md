# Independent review (G7): Story with Som + seasonal crops

- **Scope:** worktree `/home/user/econ-wt`, branch `story-local` at `db2e3cc`, diff `origin/main..HEAD` (59 files, +4917/−313).
- **What's in it:** story beats with Som; seasonal crops and the November Candle Lotus with 3 beats and "Float a wish"; the Sunday-with-Som, meet-the-animal and exam-week moments; the signature sounds and auto-quiet; the Sound & motion card; the export-table fix; the animal art restyle.
- **Reviewer:** a fresh G7 subagent with no implementation context. Rules used: `docs/qa/REVIEWER_PROMPT.md`, `docs/QA_QC.md` (gates, §8 severity) and `CLAUDE.md`.
- **Date:** 2026-11-12.

## Verdict: **FAIL**

There are 3 open S2 findings: STORY-R1, STORY-R2 and STORY-R3. G1 also fails on formatting (STORY-R4).

Security of the new RPCs and tables is solid. I found:
- no S1;
- no way for a client to get coins, tickets, seeds or gifts twice or out of season;
- no way for a normal user to move the server's calendar date;
- no leak of a wish's text.

The failures are in client behaviour, Thai text matching and Thai layout.

| Severity | Count |
|---|---|
| S1 | 0 |
| S2 | 3 |
| S3 | 6 |
| S4 | 12 |

## What I ran
- **G1 static:**
  - `typecheck` ✅
  - `lint` ✅
  - `i18n:check` ✅ (927 keys EN/TH)
  - `art:lint` ✅
  - **`format:check` ❌** (6 files, see STORY-R4)
- **G2 unit + integration:** `vitest run` gave **561/561** passing across 74 files. Coverage was 97.2% statements, 92.5% branches, 97.96% lines.
- **E2E:** this container has **no WebKit**, so I could not run the `iphone` (WebKit) project. Instead I:
  - built HEAD in an isolated copy (`git archive`, port 3197);
  - ran all of `tests/e2e` on Chromium with iPhone metrics (390×844, touch, DPR 2).
  - Result: **101 passed, 6 skipped, 1 failed**. The failure is a pre-existing flake (STORY-R21) and passes on rerun.
  - The new `story.spec.ts` (CJ-S-1..4) and `seasonal.spec.ts` (CJ-SEASON-1..2) all pass.
- **Security probes:** throwaway scripts in the session scratchpad (`g7/probe.mjs`, `g7/tz.mjs`). They ran against local Supabase as real `authenticated`/`anon` clients, with parallel calls.
- **UI probes:** Playwright Chromium at 390×844 (`g7/ui.mjs`), covering:
  - TH + dark, TH + reduced motion;
  - a 120-char Thai wish;
  - double-tap on Float;
  - client-side navigation while a claim is in flight;
  - the seasonal shop (planting and market);
  - the Seed-dex calendar in TH;
  - the Sound card in dark mode.
  - Screenshots are in `scratchpad/g7/shots/`. They are not committed.

## Security / rules verified OK (evidence)
| Check | Result |
|---|---|
| `season_clock`: can a user write it? | `insert`/`upsert` as `authenticated` → **42501**. `anon` select → 42501. Only own-row SELECT is granted, so a normal user cannot set the server's date. |
| Timezone as a date lever | Only `pg_timezone_names` values are allowed. A backward move that would reopen a finished day is refused (existing guard). A forward jump to `Pacific/Kiritimati` (+14) left `story_status.facts.day` unchanged (still before the target wake), so I found no extra beat or early season. |
| `claim_story_beat` ×10 in parallel (same beat) | 1 succeeded. `seed:candle_lotus` = 1. |
| One beat a day, parallel different beats | 1 succeeded, the others got "one beat a day" (row lock on `game_state`). |
| `deliver_seasonal_order` ×8 in parallel | 1 succeeded. +118 coins once, 3 Lotus taken. Again in Jan → "no seasonal market". Nov 2027 → allowed (new season-year), as specified. |
| `float_wish` ×6 in parallel | 1 succeeded. Before the use beat → "not yet". 121 chars and whitespace-only → refused. |
| Seasonal seed outside planting season | Day 20 → "not in the shop today". Dec 3 → Candle Lotus refused, Snow Strawberry allowed. |
| ×1.5 market price | `sell_produce` earned 24 on Nov 20 and 16 on Nov 10, for a base-16 normal item. TS `sellPrice(…, seasonPriceMult)` matches. |
| `wishes` RLS | Direct insert/update → 42501. Another user's select/delete → `[]`. Owner can read/delete. |
| Wish privacy | The `wish_floated` and `story_seen` events never contain the text (checked in the DB). The export uses the user's own RLS client. |
| Grants | Every `_story_*` / `_season_*` / `_sell_price(3)` helper: no EXECUTE for anon/authenticated. Every public RPC: `authenticated` only. All `security definer` functions have `search_path=''`. |
| Gacha pool | `GACHA_CROP_IDS` excludes seasonal crops; the SQL pools match (test updated). The Seed-dex grid and count stay at 20. |
| Daily orders | `_orders` filters out seasonal crops. |
| Export fix | `EXPORT_TABLES` now matches every `create table [if not exists]` (test fixed). The 4 new tables are included. |
| Reduced motion / skip animations | `still` disables pan/hop/sparkle. All panels are reachable, and Skip works (CJ-S-2). |
| Meow under mute | Uses `shouldPlay`, which respects the global mute and auto-quiet. |
| Touch targets | New dialog, wish form, shop sections and Sound card: no interactive element under 44×44 (measured). No horizontal scroll. |

## Findings

| ID | Sev | Where | Steps to reproduce | Expected | Actual | Suggested fix |
|---|---|---|---|---|---|---|
| STORY-R1 | **S2** | `lib/story/useStory.ts:254-259` (claim-first + `cancelled`) | 1. A user with a beat ready opens **Farm** (in the probe, `claim_story_beat` was delayed 2.5 s).<br>2. Before the claim returns, they tap **Today** in the tab bar (client-side navigation, so FarmScreen unmounts).<br>3. They come back to Farm. | STORY.md: "missing a beat loses nothing: it waits for the next calm moment". A beat that was claimed is shown. | The server recorded the beat (`story_seen = [ch0_gate]`, gift granted), but `cancelled` dropped the response. **The scene never plays**, and returning to Farm shows nothing (seen + one-a-day). For **`lotus_use` this loses "Float a wish" for the whole year**: `float_wish` needs that beat, and no other UI reaches the form. Slow networks (3G, cold start) make this likely. | Don't drop a successful claim. Either:<br>• store the claimed `{beat, gift}` outside the component (Zustand/sessionStorage) and play it at the next calm mount; or<br>• let `story_status` return "claimed today but not acknowledged" (a `played_at` column set by a tiny `ack_story_beat`), and replay until acknowledged.<br>Also offer the wish form outside the scene while this year's `lotus_use` is seen and `wishes` has no row (e.g. from the Seed-dex Lotus slot). Write the failing test first (E2E: route-delay the claim, navigate away, come back → the scene plays). |
| STORY-R2 | **S2** | `lib/game/exam.ts:5` (`/…|สอบ|ควิซ/`), used by `ExamCard`, `NightRitual` | Add an appointment titled **"ตรวจสอบรถ"** (car inspection), **"สอบถามข้อมูลธนาคาร"** (ask the bank) or **"Quiz night at bar"** / **"Final Fantasy night"**, then open Today or the Night ritual. | Only real exams bring Som's headband and "พรุ่งนี้สอบ นอนให้พอนะ". | All four match (verified with the shipped regex). "ตรวจสอบ" and "สอบถาม" are everyday Thai words, so Thai users get "exam tomorrow" for car checks or bank calls. That is broken in TH. The unit test only checks positives plus "Dentist/Gym/Testing/examine". | In Thai, require `สอบ` not preceded by `ตรวจ` and not followed by `ถาม`/`สวน`. Better: match `สอบ` at the start of the title or after a space, or the explicit forms `สอบกลางภาค|สอบปลายภาค|สอบย่อย|สอบ\s`. In English, drop bare `final(s)` and `quiz` unless they come with "exam"/"test"/course-like tokens, or keep them only as the first word. Add these titles as failing tests first. Also limit the check to `key === "appointment"` (see STORY-R16). |
| STORY-R3 | **S2** (rubric R5 < 4) | `components/farm/SeedDexSheet.tsx` `CropCalendar` (`truncate text-[11px]`, `text-[10px]`) | Open TH → Farm → **สมุดเมล็ด** → crop calendar at 390 px (screenshot `D-dex-calendar-th.png`). | R5: no truncated labels in TH; readable text. | The crop names are cut off: **"บัวหลวงแสง…"**, **"สตรอว์เบอร์รี…"**. The status lines are 10 px Thai ("เมล็ดมีในร้านถึงวันที่ 14"), and the month and name are 11 px. "Truncated labels in TH" is a listed R5 auto-fail. | Let the name wrap (`break-words`, 2 lines, `leading-snug`) instead of `truncate`. Use at least 12 px for name and status. Or use 3 columns on narrow screens (`grid-cols-3 sm:grid-cols-4`). Re-shoot TH light/dark. |
| STORY-R4 | S3 (blocks **G1**) | `components/farm/FarmScreen.tsx`, `lib/sound/sfx.ts`, `tests/e2e/story.spec.ts`, `tests/integration/story.test.ts`, `tests/unit/exam.test.ts`, `tests/unit/export-tables.test.ts` | `npm run format:check` | 0 warnings (G1) | "Code style issues found in 6 files" | `prettier --write` on those files. G1 must be re-run green before this can be ✅. |
| STORY-R5 | S3 | `supabase/migrations/20261113100000_seasonal.sql:44-56` (events insert policy) | As an authenticated client: `from('events').insert({user_id: me, type: 'story_seen', payload: {...}})` | Server-written event types are refused, as they are for every other RPC-written type. | **Allowed** (probe). `wish_floated` and `seasonal_order_delivered` are refused, but `story_seen` was never added. Analytics that read `story_seen` events can be forged. | Add `'story_seen'` to the deny list in a new migration (re-create the policy). Add a test in the RLS/events loop. |
| STORY-R6 | S3 | `components/farm/FarmScreen.tsx:53` → `useStory(moment)` with no `busy`; `lib/game/director.ts` | Open Farm during the wake window, Down Time or a running block's check-in. | STORY.md: "Never during the wake window, Down Time or a running block's check-in." | `busy` is always `false`, so a beat (with a meow) plays at any time the Farm opens. The director's `busy` rule is dead code in the app. | Pass `busy` from today's state: current block ∈ {down}, wake window open, or check-in running. Or record in DECISIONS that the Farm tab overrides this, with Minnie's OK. |
| STORY-R7 | S3 (needs Minnie) | `plant_seed` (no season check), `_crop_regrows` includes `candle_lotus`/`snow_strawberry`; comment at `20261113100000_seasonal.sql:221-222` | Buy Lotus seeds Nov 1–14 (unlimited), keep them, and plant one in March (probe: calendar set to 2027-03-05 → `plant_seed('free','candle_lotus')` OK). A plant from November also regrows forever. | The SQL comment says the crop "can't be grown out of season". STORY.md describes a crop that is *seasonal* and "comes back next year". | Seasonal crops can be grown and sold all year, and a single plant never ends. This weakens the "seasonal" idea and the seed-shop sink (`lotus_use` then works in any month of the season-year). | Decide with Minnie: (a) seasonal plants wilt after their month and the seed can only be planted in season, or (b) they stay, and the comment and docs say so. Either way, fix the misleading comment. |
| STORY-R8 | S3 | `components/today/TodayScreen.tsx:99-103` → `setQuietUntil` (module variable) | Open the app straight to `/farm` or `/more` (bookmark, PWA start URL change, push deep link) during a Focus/Work block, then trigger a sound (Som's meow, coin). | Auto-quiet: sounds rest during Focus/Work. | `quietUntil` is only set while Today is mounted, so sounds play during Focus/Work until the user visits Today. A plan change made elsewhere also leaves a stale end time. | Compute quiet from the timeline in a shared hook or the store (e.g. in the app shell), not in TodayScreen. |
| STORY-R9 | S3 | `components/story/Cutscene.tsx:132-140` (`rows={2}`) | TH, type a 120-char wish (screenshot `C-lotus-use-th-wish-long.png`). | The text is fully readable (R4/R5: no clipped Thai). | The textarea scrolls, and the first line's upper vowels/tones are cut at the top edge. | Use `rows={4}` or an auto-growing textarea with `leading-relaxed`. |
| STORY-R10 | S4 | `float_wish` / `wishes` check | `float_wish('\n\n')` | Refused as empty. | Accepted (`btrim` strips spaces only). | `btrim(p_wish, E' \t\r\n')` or `regexp_replace(…, '^\s+|\s+$', '', 'g')`, in both the function and the table check. |
| STORY-R11 | S4 | `wishes` delete policy + PK | Float, delete own wish, float again. | DECISIONS: "one per year". | Unlimited re-floats per year (delete → float). | Acceptable as "edit". If not, keep a tombstone (`deleted_at`) or check `events wish_floated` for the year. |
| STORY-R12 | S4 | `claim_story_beat` lock: `perform … from game_state … for update` | A user with no `game_state` row (probe deleted it), parallel `ch0_gate` + `lotus_open`. | One beat a day. | Both succeeded. Not reachable today (signup creates the row), so this is defence in depth. | Lock `pg_advisory_xact_lock(hashtext(uid::text))`, or `insert … on conflict do nothing` into `game_state` first. |
| STORY-R13 | S4 | `components/story/Cutscene.tsx` | Skip a gift beat (CJ-S-2). | The user learns what Som gave them. | The gift line is only on the last panel; after Skip the seed/ticket arrives silently. | Show a small toast ("+1 radish seed") on Skip when `gift` is set. |
| STORY-R14 | S4 | `components/story/Cutscene.tsx` | Press Escape or Tab on a keyboard (iPad keyboard, Mac). | Modal dialog: Escape closes it (= Skip) and focus stays inside. | No Escape handler and no focus trap. `aria-modal` alone doesn't make the page behind inert. | Reuse the Sheet's Escape handling and focus trap, or set `inert` on the app root while it is open. |
| STORY-R15 | S4 | `content/story.ts` chapter order + `_story_ready('lotus_use')` | Nov 1 opening → harvest in about 3 days → sell → next Farm visit. | The beats read in order: opening, market (day 15), then use. | `lotus_use` ("Loy Krathong… float a wish") can play around Nov 5, before the market beat. | Also require `lotus_market:<year>` seen (or day ≥ 15) for `lotus_use`, in both SQL and TS. Or accept it and note it in DECISIONS. |
| STORY-R16 | S4 | `lib/game/exam.ts` callers: `ExamCard` and `NightRitual` pass **all** fixed events | A fixed class event titled "Final project studio". | STORY.md: "an appointment tagged exam/สอบ". | Any fixed event's title counts. | Filter `key === "appointment"` before `hasExam`. |
| STORY-R17 | S4 | `_story_facts.season_uses` (event `at` at the tz **calendar** date) vs `_story_key` / `day` (**wake-day**) | Sell a Lotus at 00:30 on Nov 1, before waking. | One date basis. | The season-year of the use is 2026 while "today" is still Oct 31 (2025), so `lotus_use` waits until after wake. Harmless edge. | Use the event's wake-day, or document it. |
| STORY-R18 | S4 | tests | — | Parity: every `content/story.ts` trigger number (harvests 1, good_days 3, `from` 1/15) is tied to `_story_ready`. | Only gifts and the calendar are parity-tested; the triggers are covered indirectly by integration flows. | Add a SQL-text parity test like `seasonal.test.ts` does for the calendar. |
| STORY-R19 | S4 | `content/story.ts` `lotus_use.l1` + `SomArt pose="carrySeed"` | Look at panel 1 of "Float a wish" (`C-lotus-use-th-1.png`). | The line says Som carries your Candle Lotus. | Som holds the generic seed packet. | Add a `carryLotus` prop (small lotus in the mouth), or reword the line. |
| STORY-R20 | S4 | `components/settings/SoundCard.tsx` (off state) | Dark mode, Skip animations **off** (`E-sound-card-dark.png`). | The off switch is clearly visible. | The knob (`bg-surface`) sits on `bg-line` with very low contrast; the switch is hard to see. | Use a lighter knob or a track outline in dark mode (non-text contrast ≥ 3:1). |
| STORY-R21 | S4 (pre-existing) | `tests/e2e/onboarding.spec.ts:195` | `--repeat-each=8 --workers=4` | Stable. | 4/8 fail on a strict-mode violation: "First 10 minutes" also matches the setup-progress link "Pick a first 10 minutes". This diff didn't cause it. | Use `{ name: "First 10 minutes", exact: true }`. |

Notes (no finding):
- `season_clock` is exported in "Export all data". It is harmless, but it is test infrastructure in a user export; consider leaving it out.
- The Seed-dex calendar uses the Farm's `today` (wake-day), not `season_status.today`. They are the same in production and differ only when a test sets `season_clock`.
- `claim_story_beat`'s inventory upsert doesn't bump `updated_at`, unlike the other RPCs.
- `docs/qa/STORY-report.md` (the G1–G6 report) doesn't exist yet.

## Spec conformance (STORY.md / DECISIONS 2026-11-12)
| Rule | Result |
|---|---|
| At most one beat a day, never twice | PASS (server, parallel-safe) |
| Calm moments only; never during wake/Down Time/check-in | **FAIL**: `busy` not wired (STORY-R6) |
| Always skippable; reduced motion = still panels; muted with global mute | PASS |
| Missing a beat loses nothing | **FAIL**: a claim lost on unmount (STORY-R1) |
| Gifts by `claim_story_beat`, re-checked from data | PASS |
| Each beat logs `story_seen` | PASS, but clients can forge it too (STORY-R5) |
| Seasonal: seed days 1–14 at 80, market day 15+ ×1.5, order 3 for 118 once per crop per year | PASS (probes and tests) |
| Opening/market only in month, once per year; use after first sale/delivery | PASS (STORY-R15 is an ordering quirk) |
| Wish optional, ≤ 120, private, one per year, event without text | PASS (STORY-R10 and STORY-R11 are S4) |
| Capsule drop / December beats / wish return | Deferred, recorded in DECISIONS |
| Exam week (appointment tagged exam/สอบ) | **FAIL** in TH (STORY-R2) |
| Sunday with Som: kind, never scolding | PASS (`somWeek` tests) |
| Meet the new animal (13 species, different lines) | PASS (`pen.somMeets.*` EN/TH, 13 keys) |
| Sound: 5 signature sounds under global mute; auto-quiet Focus/Work; timers still ring | PASS, with a gap (STORY-R8) |
| Sound & motion settings in More | PASS (switches, ≥ 44 px, sound saved to the profile, auto-quiet disabled when muted) |

## UX budgets
- **Story beat:**
  - Ch0 is 4 panels: 3× Next + Done = 4 taps, or 1 tap Skip.
  - Lotus use: 2× Next → wish → Float → Done = 5 taps, or Skip any time.
- **Seasonal:** seed purchase is 1 tap (Shop tab already open), and order delivery is 1 tap.
- **States:**
  - Seasonal sections hide when `season_status` fails (the shop works as before).
  - The wish has an error state (`role=alert`).
  - The cutscene has no loading state, by design: it appears only after the claim succeeds.
- **Touch targets:** all ≥ 44 px (measured).

## Rubric (new UI: cutscenes, Som, Candle Lotus, shop sections, crop calendar, Sound card)
I could not open the animal restyle at 48 px in a prod build, because `/dev/art` returns 404 in production builds and there is no WebKit here. Its scores rely on `art:lint` ✅ and the decision log's QC rounds with Minnie.

| # | Score | Reason |
|---|---|---|
| R1 Style | 4 | Flat, no outlines, 2–3 tones; the sky is the only gradient (CSS on scene backgrounds). |
| R2 Consistency | 4 | Som and the krathong/lotus scenes match the farm set. The Lotus art reads as the same artist. |
| R3 Readability | 4 | Candle Lotus and Snow Strawberry are distinct at 48 px; the calendar silhouettes are deliberately uniform. |
| R4 Layout | 4 | No horizontal scroll; dialog centred; targets OK. The wish textarea clips when scrolled (STORY-R9). |
| R5 Typography | **3** | TH calendar labels truncated, 10–11 px text (STORY-R3); Thai clipped in the 2-row textarea. |
| R6 Color & contrast | 4 | Tokens throughout; dark mode works. The off-switch contrast is weak (STORY-R20). |
| R7 Motion | 4 | Soft pan/hop/sparkle, honours reduced motion and skip animations. Not verified on WebKit. |
| R8 Delight | 4 | Meow + sparkles + gift line. The Skip path loses the payoff (STORY-R13). |
| R9 Not AI-looking | 4 | Simple and intentional. No red flags: sparkles are limited to "sparkle" panels. |

## Top 3 improvements
1. **Make a claimed beat survive** a navigation, reload or slow network, and give "Float a wish" a fallback entry point (STORY-R1). Players will see this as "the story skipped itself".
2. **Tighten the exam matcher** for Thai (ตรวจสอบ/สอบถาม) and limit it to appointments (STORY-R2, STORY-R16). It's Minnie's own use case, and a wrong "exam tomorrow" at night undermines trust.
3. **Thai layout pass on the crop calendar and the wish box** (STORY-R3, STORY-R9), then re-shoot TH light/dark. Also fix `format:check` (STORY-R4) and add `story_seen` to the event deny list (STORY-R5). Both are one-line fixes.
