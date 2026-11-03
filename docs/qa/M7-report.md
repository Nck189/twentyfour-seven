# QC Report — M7: Economy + gacha + setup rewards
Date: 2026-11-03 · Branch: `m7-local` → `claude/practical-cannon-a70ubq`, PR #7 · Previews: `/dev/farm` (capsule machine, Seed-dex), `/dev/art` (capsules, Set up card)

Scope: seed capsule machine (`pull_gacha` ×1/×10, rates + pity per SPEC §8.5, idempotent per tap), duplicates → shards → star-up ★1–5, Seed-dex with silhouettes + completion %, owned seeds in the planting picker, the reveal (shake → crack → rarity light → jingle by rarity, Skip, ×10, reduced motion), setup rewards (SPEC §8.8c) incl. the Home Screen launch report. Ticket grants: Sunrise/Night already live (M3/M4); Perfect day + streak milestones → M9, Weekly review → M10 (DECISIONS 2026-11-03).

## Gate results
| Gate | Result | Evidence |
|---|---|---|
| G1 Static | ✅ | tsc 0 (only the known Next `LayoutProps` typegen noise) · eslint 0 · prettier clean · i18n 516 keys EN = TH · no emoji (unit guard) · art: tokens only, no black, gradients only in the sky |
| G2 Functional | ⏳ CI | unit 215/215 incl. gacha (100k seeded sim: pity never exceeded, rates in band, ~1 legendary / 55 pulls), SQL mirrors content (gacha + setup rewards), reveal Skip/timers + dialog focus (fake timers), one pull / one star-up per tap, export covers every migration table · integration `gacha.test.ts` (SQL roll = TS on 300 inputs, 100k SQL sim, charging, exact repeat cards, prefix keys, race with 1 ticket, star-up, owned-seed planting) + `setup-rewards.test.ts` (once-only, undo/redo, Home Screen, no client writes) — verified on a scratch Postgres 16 (16 migrations apply) · E2E `gacha.spec.ts` CJ-12 a–d × 6 devices — CI run on PR #7 |
| G3 Visual QC | ⏳ | self-review on `/dev/art` + `/dev/farm` at 390 px light/dark (capsules, machine, ×1/×10 reveal, Seed-dex, Set up card); fixes below; screenshots sent to Minnie. Mac baselines (`npm run e2e:update`) add `capsules-*` and `seeddex-*` |
| G4 UX QC | ✅ (local) | pull = 2 taps (machine → Pull); reveal ≤ 2.2 s, Skip any time, off with reduced motion / skip animations; results as pictures (crop on its rarity light, New! / +shards); pity counters visible; 0 tickets → disabled + how to earn; touch targets ≥ 44 px; reveal is a modal dialog (focus Skip → Done, results announced) |
| G5 Data & security | ✅ (local) | rolls, tickets, shards, stars, seeds and setup rewards only in security-definer RPCs checking `auth.uid()`; `unlock_grants` select-only; `gacha_pull`, `star_up`, `unlock_granted` are server-only events; idempotent per key (exact match); row locks stop double-spend races; setup steps checked from the data, once per account |
| G6 Production smoke | ⏳ | after merge + `npx supabase db push --remote` (2 migrations: `20261103070000_m7_gacha`, `20261103080000_m7_setup_rewards`). The farm's capsule row only appears once the RPCs answer |
| G7 Independent review | ✅ | review 1 (`G7-M7.md`) FAIL: R-M7-1, R-M7-2 S2 → fixed test-first → re-review 1 (`G7-M7-rereview.md`) FAIL: R-M7-R1 S2 (flaky CJ-12b) → fixed → **re-review 2 PASS** (`G7-M7-rereview-2.md`, 55e88ab) |

## Rubric (self-review)
| Item | Self | Note |
|---|---|---|
| R1 Style compliance | 4 | capsules + machine from the farm parts (Ball, Shadow, Sparkle), 2–3 tones, top-left light |
| R2 Consistency | 4 | rarity tones reuse the palette (stone/leaf/blue/purple/yellow) |
| R3 Readability | 4 | capsule halves read as a capsule at 48 px after the redraw |
| R4 Layout | 4 | ×10 as a 5-column grid at 390 px; rarity and New!/shards on their own lines |
| R5 Typography | 4 | plural-aware shard strings |
| R6 Color & contrast | 4 | New! in primary green; overlay now solid (no farm showing through) |
| R7 Motion | 4 | shake → staggered pop → light; skippable |
| R8 Delight | 4 | jingle rises with rarity; sparkles for epic/legendary |
| R9 Not AI-looking | 4 | hand-built SVG |

## Issues found & fixed (self QC)
| ID | Sev | Description | Fixed in |
|---|---|---|---|
| V-M7-1 | S3 | capsule looked like a lamp/mushroom; capsules opened while popping | real half-sphere bottom; closed while popping |
| V-M7-2 | S3 | ×10 cards wrapped "Common ·" mid-line; "+1 shards" | rarity and New!/shards on separate lines; ICU plurals |
| V-M7-3 | S4 | reveal overlay let the farm show through (busy) | solid background |

## G7 fixes
| ID | Sev | Description | Regression test |
|---|---|---|---|
| R-M7-1 | S2 | Skip during the shake was undone by the shake timers (crack replayed, jingle late) | unit `reveal.test.tsx` (fake timers) |
| R-M7-2 | S2 | no CJ-12 E2E | `tests/e2e/gacha.spec.ts` CJ-12 a–d; visual matrix + capsules/Seed-dex |
| R-M7-R1 | S2 | CJ-12b flaky (hard-coded pity) and its double-tap check couldn't fail | CJ-12b reads pity from the server, seeds 3 tickets; unit test proves the guard (fails without it) |
| R-M7-3/11 | S3/S4 | a repeated key returned cards without New!/shards; prefix key match | integration (exact repeat cards; `key:9` is a new pull) |
| R-M7-4 | S3 | star-up double-tap spent twice | unit `seeddex.test.tsx` |
| R-M7-5 | S3 | setup rewards paid silently | "Setup reward" notice on Today/More |
| R-M7-6 | S3 | `unlock_grants` (and M3/M5's `wake_snapshots`, `coin_grants`) missing from export + RLS loops | unit `export-tables.test.ts` |
| R-M7-7 | S3 | reveal not an accessible modal | unit (dialog, focus, live region) |
| R-M7-12, R-M7-R2, R-M7-R6, R-M7-R2-1..3 | S4 | TRUNCATE grant; empty answer crash; silhouettes unasserted; weak guard test; no try/finally (+ randomUUID fallback); Skip timing in E2E | fixed |

## Known issues (S3/S4 only)
| ID | Sev | Description | Plan |
|---|---|---|---|
| K-M6-1, R-M6-4, R-M6-R1, R4-1 | S3 | client-written block_logs feed farm growth; harden before Perfect day / streak tickets pay | M9 (with those grants) |
| R-M7-8 | S4 | SQL soft-pity exact vs TS float (1 ulp at boundaries) | none needed |
| R-M7-9 | S4 | commons pulled give seeds that duplicate the free starters | M9 compost / sell |
| R-M7-10 | S4 | language and wake-time steps use weak signals (pay ≤ doing the real thing) | revisit with a timezone setting |
| R-M7-13 | S4 | 100k rate assertions are loose bands | tighten later |
| R-M7-14 | S4 | Today's Set up line shows until hidden (SPEC: "once") | question for Minnie |
| R-M7-R3..R5 | S4 | Tab can reach the farm under the reveal / focus not returned after Done; no notice for the Home Screen decor; notice lost if Today is left before the claim answers | polish |

## Questions for Minnie
- Setup reward numbers (2 strawberry seeds, 1 ticket, 20 / 15 / 5 coins, flowers) and gacha numbers — OK?
- Today's "Set up 24/7" line: until hidden (now), or only once?
