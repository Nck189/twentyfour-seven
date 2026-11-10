# QC Report — M8: Exercise + animals
Date: 2026-11-03 · Branch: `m8-local` → `claude/practical-cannon-a70ubq`, PR #8 · Previews: `/dev/farm` (exercise card, pen, animal sheet, hatch), `/dev/art` (13 animals awake/sleepy, egg, produce, feed)

Scope: weekly exercise ring + quick log (Today), plan a workout in a block with the gym-close warning (Plan), weekly goal + gym close (More, setup row → 3 feed bags); server-side `log_exercise` (feed 2 days per counted workout, every 3rd hatches an egg), `pet_animal`, `collect_produce`, `use_feed`; 13 hand-built species with idle motion, sleepy (never dead) when hungry, love meter, produce, hatch reveal.

## Gate results
| Gate | Result | Evidence |
|---|---|---|
| G1 Static | ✅ | tsc 0 (known Next `LayoutProps` noise only) · eslint 0 · prettier clean · i18n 593 keys EN = TH · art lint 0 (13 art files) · no emoji |
| G2 Functional | ⏳ CI | unit 231/231 (rules incl. rolling 24 h caps, hearts, hatch rates over 100k, SQL mirrors content + 24 h windows, workout slot) · integration `animals.test.ts` (SQL hatch = TS on 300 inputs, counting/caps/feeding/hatch, timezone can't reset caps, refusals, pets/produce/feed, setup row) + `backlog.test.ts` rolling coin cap · E2E `animals.spec.ts` CJ-13 a–c × 6 devices — CI on PR #8 · verified on scratch Postgres 16 (17 migrations; 100k SQL hatches 50.1/29.6/13.2/5.1/1.9 %) |
| G3 Visual QC | ⏳ | self-review at 390 px light/dark (pen, animal sheet, sleepy, log sheet, hatch) + art sheet; fixes below; screenshots sent to Minnie. Mac baselines (`npm run e2e:update`) — the Farm screen now includes the pen |
| G4 UX QC | ✅ (local) | log = 3 taps (Log → type picture → Log it; 30 min preselected) · pet = 2 taps · touch targets ≥ 44 px · hatch ≤ 1.3 s, Skip, off with reduced motion / skip animations · labels on every animal tile (`Cow: fed`) · sound per species, muted by the sound setting |
| G5 Data & security | ✅ (local) | workouts insert only through `log_exercise`; animals, inventory, game_state, server events not client-writable; caps over rolling 24 h (no timezone trick); `profiles.timezone` real zone names only; idempotent per key; row locks against races |
| G6 Production smoke | ✅ | `npm run qc:prod` on prod, 2026-11-10 (Minnie, after `db push` of every v1 migration): 22/22 passed on iphone + chrome-desktop, Lighthouse assertions passed. Tests that need their own user skip on prod, by design. Covers smoke (login → today → check-in → farm), every screen with no raw keys or horizontal scroll (EN/TH, light/dark), CJ-17 export, PWA manifest + service worker |
| G7 Independent review | ✅ | review 1 (`G7-M8.md`) FAIL: S1 R-M8-1 (timezone reset the caps), S2 R-M8-2 (CJ-13 locator) → fixed test-first → re-review 1 (`G7-M8-rereview.md`) FAIL: S2 R-M8-R1 (M5 backlog coin cap, same root cause) → fixed → **re-review 2 PASS** (`G7-M8-rereview-2.md`, 7966fb1) |

## Rubric (self-review)
| Item | Self | Note |
|---|---|---|
| R1 Style compliance | 4 | flat, no outlines, 2–3 tones, top-left light, flat shadow, eyes in soft brown (no black) |
| R2 Consistency | 4 | two shared body plans + the crop parts and palette |
| R3 Readability | 4 | every species reads at 48 px after the cow/alpaca/red panda fixes |
| R4 Layout | 4 | pen 3 columns at 390 px, 5 on iPad/Mac |
| R5 Typography | 4 | |
| R6 Color & contrast | 4 | sleepy note on warn-soft; light + dark checked |
| R7 Motion | 4 | gentle bob + blink, egg wobble, heart float; all off with reduced motion |
| R8 Delight | 4 | per-species calls, hatch jingle by rarity, capybara's yuzu |
| R9 Not AI-looking | 4 | hand-built SVG |

## Issues found & fixed (self QC)
| ID | Sev | Description | Fixed in |
|---|---|---|---|
| V-M8-1 | S3 | cow read as a pig; alpaca as a cat on a stick; red panda as a cat | horns + head spot; banana ears + topknot; dark legs, ear tips, brows |

## G7 fixes
| ID | Sev | Description | Regression test |
|---|---|---|---|
| R-M8-1 | S1 | 2-a-day workout cap and 3-pets cap reset by changing `profiles.timezone` (POSIX offsets) | unit (rolling window), integration (fake zone refused; real zones + 23 h backdating don't reset) |
| R-M8-2 | S2 | CJ-13 `getByText` strict-mode double match | E2E reads the live region |
| R-M8-R1 | S2 | backlog coin cap (M5) reset by switching to a real zone whose midnight just passed | integration `backlog.test.ts` (fails on calendar-day code) |
| R-M8-3..7, R-M8-R2/R3 | S3 | CJ-13b race; no-op blur paid; settings errors silent; calendar day in caps; love meter frozen; tests passing on old code; copy said "today" | fixed with tests |

## Known issues (S3/S4 only)
| ID | Sev | Description | Plan |
|---|---|---|---|
| R-M8-8 | S3 | hatch reveal nested in the log sheet: Tab reaches controls behind, Escape closes the sheet, focus not restored after Done | shared modal helper (with the capsule reveal) |
| R-M8-4/5 rest | S3 | `exercise_settings_saved` is client-insertable (pays 3 feed bags once); a failed settings load shows no message | server-side settings RPC later |
| R-M8-R2-1 | S3 | (M4) switching east opens the Night ticket window early (still once per date) | anchor the window to the frozen wake target only |
| R-M8-R2-4 | S4 | (M5) a client can change a backlog item id to re-earn within the cap | id immutable trigger |
| others | S4 | per-review lists in `G7-M8*.md` | polish |

## Questions for Minnie
- Animal art OK? Which to tweak?
- 2 counted workouts per rolling 24 h (instead of "per day") OK?
