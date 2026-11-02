# QA/QC Process — mandatory for every milestone

Minnie's requirement: **she should not have to fix anything herself.** A milestone is NOT done, and the ✅ message is NOT sent, until it passes every gate below. Treat this like a quality control plan in a factory: fixed gates, an inspection checklist, measured criteria, and a report for every lot (milestone).

Two core rules:
- **A bug fix starts with a failing test.** When you find a bug, first write a test that reproduces it, then fix it. That bug can never come back silently.
- **No open S1/S2 issues at milestone end** (severity scale in §8).

---

## 0. Tooling (set up in M0, extend as features land)
| Purpose | Tool |
|---|---|
| Types / lint / format | `tsc --noEmit`, ESLint (strict, `jsx-a11y`), Prettier check |
| Unit + property tests | Vitest + `fast-check` (engine and game invariants) |
| DB / RLS / RPC tests | Supabase local (`supabase start`) + Vitest integration, or pgTAP |
| E2E | Playwright, projects listed in §2 (use **WebKit** — Minnie uses Safari on iPhone/iPad/Mac) |
| Visual regression | Playwright `toHaveScreenshot()` baselines in `tests/visual/` |
| Accessibility | `@axe-core/playwright` |
| Performance / PWA | Lighthouse CI against the Vercel preview |
| Art lint | `scripts/qc-art-lint.ts` (see §4.2), built in M6 |
| Art sheet | Dev-only route `/dev/art` (built in M6) |

Wire everything into npm scripts:
- `npm run qc` runs gates 1–5 locally.
- `npm run qc:prod` runs gate 6 against the deployed URL.
- Add a GitHub Actions workflow that runs `npm run qc` on every push.

---

## 1. The gates (run in order; on a fail → fix → re-run that gate and every gate after it)

| Gate | What | Pass criteria |
|---|---|---|
| **G1 Static** | typecheck, lint, format, i18n key check | 0 errors, 0 warnings; no `any` without a comment; no leftover `TODO`/`console.log`; every user-facing string exists in both EN and TH |
| **G2 Functional** | unit + property + integration + E2E | 100% pass across ALL milestones so far (full regression, not just new tests); coverage ≥ 90% for `lib/engine` and `lib/game`, ≥ 70% overall |
| **G3 Visual QC** | screenshots + rubric self-review + visual regression + art lint | every rubric item ≥ 4/5 (§4); art lint 0 violations; no unexpected visual diffs (intended diffs: update baselines and say why in the report) |
| **G4 UX QC** | interaction budgets, touch targets, a11y, motion | budgets in §5 met; axe: 0 serious/critical; all controls ≥ 44×44px |
| **G5 Data & security** | RLS, server-side game logic, secrets | user A can't read or write user B's rows; gacha/tickets/coins only change through RPC; `git grep` finds no keys; `.env*` not tracked |
| **G6 Production smoke** | after push, against the live Vercel URL | E2E smoke (login → today → check-in → farm) passes on production; Lighthouse mobile: PWA ≥ 90, Performance ≥ 85, Accessibility ≥ 95; manifest + service worker valid |
| **G7 Independent review** | a fresh subagent reviews with no implementation context | reviewer verdict "PASS"; every S1/S2 it finds is fixed, then re-reviewed |

**Fix-loop limit:** at most 3 attempts per gate. If something still fails, ask: is it S3/S4?
- Yes → log it in the report under Known issues and continue.
- No (S1/S2) → stop, write a blocker in PROGRESS.md, and ask Minnie one clear question.

---

## 2. Test matrix (Playwright projects)
| Project | Engine | Viewport | Notes |
|---|---|---|---|
| iphone | WebKit | 390×844, DPR 3, touch | **primary**; safe-area insets on |
| iphone-small | WebKit | 375×667, touch | overflow and cramped layouts |
| ipad-portrait | WebKit | 1024×1366, touch | split view |
| ipad-landscape | WebKit | 1366×1024, touch | |
| mac | WebKit | 1440×900, mouse | Safari "Add to Dock" |
| chrome-desktop | Chromium | 1440×900 | sanity check only |

- **Visual QC** runs each screen in: light + dark UI, EN + TH, and farm sky at dusk / night / sunrise / day.
- Use a **fixed clock** in tests (Playwright `clock` API, Asia/Bangkok) and **seeded data fixtures** (`tests/fixtures/`) so screenshots are deterministic.

---

## 3. Critical user journeys (E2E — must always pass; add the v2 ones as they ship)
| ID | Journey | Expected |
|---|---|---|
| CJ-01 | Magic-link login (Supabase local) | lands on Today; session persists after reload |
| CJ-02 | First login | Minnie's defaults seeded exactly as SPEC §2 (7 blocks, 6 templates, goal 3, gym 22:00, tags) |
| CJ-03 | "I'm up" at target+10 min | +1 Sunrise ticket, ☀️ flagged, `wake_events.in_window = true` |
| CJ-04 | "I'm up" at target+20 min | time logged, NO ticket, in_window false |
| CJ-05 | Block check-in | start → first-10 → 3 items → close in **≤ 5 taps and ≤ 5 s** |
| CJ-06 | Backfill a past block | counts toward %, labeled backfilled, no ticket or mutation |
| CJ-07 | Night ritual end to end | open blocks closed with reasons; tomorrow planned; seeds planted; Night ticket +1 |
| CJ-08 | Push bedtime +90 min on a free day | tomorrow re-flows +90; the next night snaps back; Free shrinks |
| CJ-09 | Push bedtime +2 h before Wed class | class unmoved; compression order respected; "only Xh sleep" warning |
| CJ-10 | "Out late tonight" | tagged `planned`; no weeds, no miss next day |
| CJ-11 | Backlog drag on touch + "Move to…" | item lands in that day's Work block; capacity bar turns red when over |
| CJ-12 | Gacha ×1 and ×10 | tickets deducted server-side; pity counter correct; 0 tickets → disabled; **double-tap doesn't double-spend** (idempotency key) |
| CJ-13 | Exercise log ×3 | animals fed (fed_until +2 days per workout); egg hatches on the 3rd |
| CJ-14 | Language toggle | persists across reload and devices; no raw keys visible anywhere |
| CJ-15 | Two devices at once (two browser contexts) | edits sync; no lost update (`updated_at` check / realtime) |
| CJ-16 | Network failure mid-action | optimistic UI rolls back with a friendly message; no data loss; retry works |
| CJ-17 | Export all data | JSON + CSV download; re-import round-trips (M14) |
| v2 | push subscribe, .ics feed, anonymous share view (free/busy ONLY — assert no titles leak), booking rate limit, factory queue timing | |

---

## 4. Visual / aesthetic QC

### 4.1 Self-review procedure (every milestone that touches UI)
1. Render all new/changed screens in the matrix (§2), plus `/dev/art` whenever art changed.
2. **Look at every screenshot yourself** (open the PNGs) and score the rubric below. Write the scores and one-line notes into the report.
3. Put the screenshot next to `design/reference-style-a.svg` (the style Minnie picked) and ask: does it look like the same artist made both?
4. Fix anything scoring < 4, re-shoot, re-score.

### 4.2 Automated art lint (`scripts/qc-art-lint.ts`) — fail on:
- any `stroke` set to black or near-black (`#000`, `#111`, `#222`, `black`, `rgb(0,0,0)`, luminance < 15%)
- any stroke wider than 1.5px on art components
- any color literal in `components/art/` that isn't a token from `styles/tokens.css`
- `filter: drop-shadow`, `box-shadow` or blur on art (flat style); gradients anywhere except sky components
- an SVG without a `viewBox`, or text baked into art

### 4.3 Rubric (score 1–5; every item must be ≥ 4)
| # | Item | 5 looks like… | Auto-fail if… |
|---|---|---|---|
| R1 | Style compliance | flat, no outlines, pastel, 2–3 tones, light from top-left | any outline that reads as "drawn line"; black anywhere |
| R2 | Consistency | every object looks like it came from the same set as the reference; same corner roundness and saturation | one object noticeably more detailed, saturated or realistic than the rest |
| R3 | Readability | each crop/animal identifiable at 48px; growth stages clearly distinct | two items confusable at 48px |
| R4 | Layout | 4/8px spacing grid; aligned edges; no clipping; respects iPhone safe areas | overlap, cut-off text, horizontal scroll, content under the notch or home bar |
| R5 | Typography | clear hierarchy (max 3 sizes per screen); Thai renders with correct line-height (~1.6) and no tofu | missing glyphs, Thai vowels/tones clipped, truncated labels in TH |
| R6 | Color & contrast | tokens only; text meets WCAG AA (4.5:1, large 3:1); dark mode intentional | unreadable text on any sky/background |
| R7 | Motion | UI 150–300 ms ease-out; celebrations ≤ 2.5 s and skippable; `prefers-reduced-motion` honored | jank, layout shift, animation that can't be skipped |
| R8 | Delight | harvest and gacha have anticipation → reveal → payoff, synced with sound; idle farm feels alive (small loops) | a reward moment that feels flat or silent |
| R9 | "Not AI-looking" | hand-crafted, intentional, simple | any red flag below |

**"AI-look" red flags** (each one = R9 fail):
- black or uniform dark outlines
- default purple/blue gradients
- glossy plastic highlights
- random sparkles everywhere
- inconsistent perspective (mixing top-down, side and isometric)
- over-detailed textures next to simple shapes
- emoji used as artwork
- mixed icon styles
- melted or asymmetric shapes that look unintentional
- generic stock-illustration people

### 4.4 Fonts
- Use one font pair that supports Thai well and fits the cozy rounded look, e.g. **Nunito** (Latin) + **IBM Plex Sans Thai Looped** or **Noto Sans Thai Looped** (Thai).
- Self-host via `next/font`.
- Verify the TH screenshots specifically.

---

## 5. UX budgets (G4)
- **Taps:**
  - block check-in ≤ 5 taps
  - "I'm up" = 1 tap from launch
  - plan tomorrow ≤ 2 minutes on a seeded day (count the steps in CJ-07)
- **Feedback:** every tap gives feedback within 100 ms (pressed state); a spinner only after 300 ms.
- **First load:** Today screen interactive < 2.5 s on the production URL (Lighthouse mobile).
- **Touch targets:** ≥ 44×44px — assert with a Playwright helper on every screen.
- **Empty / loading / error states:** every list and screen has all three, in both languages.
- **No dead ends:** every sheet or modal has a visible close/back; every drag has "Move to…".

---

## 6. Logic invariants (property-based, fast-check)

**Engine:**
- blocks never overlap
- fixed events are never moved
- minimum durations are respected
- the total per day is consistent
- the sleep warning fires if and only if sleep < configured duration
- snap-back always returns to target within 1 night
- planned deviations never create misses

**Game:**
- growth is never negative
- quality ∈ {N, S, G, P}
- penalties follow 1 / 3 / 5 consecutive misses exactly; none in vacation/sick mode or for `planned`
- the streak survives a minimum day and uses a freeze only when available (max 2)

**Gacha** (server RPC, 100k simulated pulls):
- rates within ±0.5 pp (chi-square p > 0.01)
- pity never exceeded (10 / 30 / 80)
- duplicates → essence math correct
- concurrent pulls can't overspend tickets

**Time:**
- day boundary = wake → next wake
- correct across midnight, month end (season switch) and leap day
- timezone comes from the profile, never from the server clock

---

## 7. Independent review (G7)
After G1–G6, launch a **fresh subagent** using the prompt in `docs/qa/REVIEWER_PROMPT.md`. Give it:
- the milestone section of BUILD_PLAN
- the relevant SPEC sections
- the screenshots folder
- the local URL

Do NOT give it your implementation notes. It must try to break things and score the rubric independently. Fix its S1/S2 findings, then re-run the review once.

---

## 8. Severity scale
| Sev | Meaning | Policy |
|---|---|---|
| S1 Blocker | data loss, crash, security/RLS hole, can't complete a core journey, wrong rewards | must fix before ✅ |
| S2 Major | a feature behaves differently from the spec, a rubric item < 4, broken in TH or dark mode, an iPhone-only bug | must fix before ✅ |
| S3 Minor | cosmetic or edge polish that doesn't block use | fix if quick, else log as a Known issue |
| S4 Trivial | nitpick | log only |

---

## 9. QC report (every milestone) → `docs/qa/M<x>-report.md`
Use `docs/qa/REPORT_TEMPLATE.md`.

The ✅ message to Minnie carries a one-line QC summary, e.g.:
`QC ✅ G1–G7 pass · tests 212/212 · e2e 17 · visual avg 4.6/5 · known issues: 1 (S4)`
