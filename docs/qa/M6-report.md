# QC Report — M6: Art system + farm scene
Date: 2026-11-03 · Branch: `m6-local` → PR after PR #5 merges · Preview: `/dev/farm`, `/dev/art` (dev/QA only)

## Gate results
| Gate | Result | Evidence |
|---|---|---|
| G1 Static | ✅ | tsc 0 · eslint (max-warnings 0) 0 · prettier clean · i18n 0 missing (462 keys EN = TH) · art lint 0 (10 art files, 55 tokens) · no emoji (unit guard) |
| G2 Functional | ⏳ CI | unit 196/196 (game rules 31: block result, OEE/minimum/perfect day, mutations, quality, growth + weeds/wilt/death, regrow, weather, giants, seeded week → farm state; SQL mirrors content) · coverage lib/game 99% lines / 94% branches · integration `farm.test.ts` (plant/harvest rules, **seeded week: server ripeness = lib/game**, decor coins atomic) — verified on a scratch Postgres 16 (14 migrations apply; the seeded week harvests exactly the 4 ripe plots); CI run pending · E2E `farm.spec.ts` (plant in 2 taps, harvest a ripe crop, replace asks first) × 6 devices — CI pending |
| G3 Visual QC | ⏳ | self-review below on the `/dev/art` sheet (20 crops × 4 stages × weeds/wilt/quality/mutation at 48/96/192 px, day + night) and `/dev/farm` (iPhone 390 day/night, iPad/Mac 1180, plot sheets); fixes made from it (shadows on soil, cherry tree clipped, rose read as a face, busy tiles, night squares, clipped sun). Mac baselines + Minnie's screenshot approval still to do |
| G4 UX QC | ✅ (local) | plant = 2 taps (plot → seed picture) · harvest = 2 taps · pictures first (block name only label on a tile; strongest mutation as a small badge; full detail in the sheet) · touch targets ≥ 44 px · labels on every plot (`Focus: Radish, day 1 of 3`) · harvest pop ≤ 1.6 s, tap to skip, off with reduced motion / skip animations · E2E a11y check in CJ-M6-1 (CI) |
| G5 Data & security | ✅ (local) | plots/inventory/decor/events are not client-writable; plant/harvest/buy are security-definer RPCs; ripeness re-checked server-side with the same rules; seeds limited to starters until M7; coins only drop atomically (`coins >= price` in the UPDATE); `seed_planted`, `harvest`, `decor_bought` are server-only event types |
| G6 Production smoke | ⏳ | after merge + `npx supabase db push --remote` (the farm reads prod before the migration too) |
| G7 Independent review | ⏳ | running (notify-only for M6 per autopilot rules) |

## Rubric (self-review)
| Item | Self | Note |
|---|---|---|
| R1 Style compliance | 4 | flat, no outlines, 2–3 tones, top-left light, flat soil shadow; one 1.5 px same-color join on stars (allowed) |
| R2 Consistency | 4 | every crop built from the same parts (Ball / Leaf / Stem / Shadow) and the reference palette |
| R3 Readability | 4 | each crop has one big silhouette at 48 px; stages 0–2 share shapes, the bud shows the crop's color |
| R4 Layout | 4 | 4 + 3 grid on iPhone, 7 in a row on iPad/Mac; nothing clipped at 390 px |
| R5 Typography | 4 | block names under tiles, sheet titles = block |
| R6 Color & contrast | 4 | night veil keeps crops readable; labels switch to star color at night |
| R7 Motion | 4 | squash → stretch → settle, burst, ≤ 1.6 s, skippable |
| R8 Delight | 4 | harvest pop + rising sparkle sound; weather badges |
| R9 Not AI-looking | 4 | hand-built SVG components, tokens only |

## Issues found & fixed (self visual QC)
| ID | Sev | Description | Fixed in |
|---|---|---|---|
| V-M6-1 | S3 | crop shadow (cream) read as a pale blob on the soil bed | `--shadow-on` = darker soil inside plots |
| V-M6-2 | S3 | cherry tree canopy clipped at the top; quality star clipped | redrawn lower / star moved in |
| V-M6-3 | S3 | crystal rose looked like a gem, then its heart read as a frowning face | rose cup + petal fold, no line arcs |
| V-M6-4 | S2 (Minnie: "ลายตา") | every tile carried rainbow + particles — busy | tiles show only the strongest mutation as a corner badge |
| V-M6-5 | S3 | at night every plot had a dark square (veil per tile) | one veil over the field |
| V-M6-6 | S3 | sun clipped on wide screens (sky cropped to a band) | gradient band + fixed-size sun/moon anchored to the edges |
| V-M6-7 | S3 | dev farm preview didn't hydrate (searchParams without Suspense under cacheComponents) | client `useSearchParams` in Suspense |

## Known issues (S3/S4 only)
| ID | Sev | Description | Plan |
|---|---|---|---|
| K-M6-1 | S3 | Growth reads client-written block_logs (started_at, items_done) — same as R-M3-14; harvest has no coin value yet, so nothing to farm until M7 | M7: harden inputs before produce/harvest pay anything |
| K-M6-2 | S4 | Dead crops go straight to "Clear and replant"; compost's fertilizer comes with M7 inventory | M7 |
| K-M6-3 | S4 | Decor sits in a row along the field (no free placement) | M9 farm expansion (drag + Move to…) |
| K-M6-4 | S4 | Giant crop is a banner, not one sprite across 3 tiles (tiles wrap 4 + 3 on iPhone) | revisit with the wider farm |

## Screenshots reviewed (cloud, production build)
- `/dev/art` sheets: crops by rarity (day), night, states, mutations, decor, skies
- `/dev/farm`: iPhone 390 day + night, plant sheet, ripe-crop sheet; 1180 wide
