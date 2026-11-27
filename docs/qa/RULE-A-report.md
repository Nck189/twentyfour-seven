# QC report: rule A — the farm is hurt by missed days, not missed blocks

Minnie asked for this on 2026-11-27 ("แก้ทั้งหมดเลยก่อนเบต้า"), after the 7-block flexibility and retention analysis. See the DECISIONS entry for 2026-11-27 and SPEC §8.4.

| Gate | Result | Evidence |
|---|---|---|
| G1 Static | ✅ | `npm run qc:static`: typecheck, lint, Prettier, i18n (EN = TH), art lint |
| G2 Functional | ✅ | vitest 791/791 (unit + integration: TS↔SQL harvest parity over 40 random weeks; a new rule-A server scenario covering a Vacation pause, a day kept by the ritual alone, and wilt lowering quality; away vs quiet vs missed days). Local E2E Chromium: 168 passed, 1 skipped, 0 failed |
| G3 Visual | ⏳ Mac baselines | Today's farm warning line and the plot-sheet text changed. Re-record the Mac visual baselines once the whole flexibility batch is in |
| G4 UX | ✅ | One warning line for the whole farm, hidden once today has an anchor or on Vacation/Sick days. Copy says "no on-time I'm up and no Night ritual", never "missed day" (the scarecrow's word) |
| G5 Data & security | ✅ | Server mirror `_plot_harvest` (migration `20261128000000`): `security definer`, `search_path=''`, no new grants. Harvest value is still decided server-side |
| G6 Production | ⏳ | Before merge, Minnie runs `npx supabase db push --remote` (1 migration). After merge: `npm run qc:prod` |
| G7 Independent review | ✅ PASS on re-review | First review FAILED with 2 S2s, both fixed: a planned late night forgave an oversleep; logging a bad day made it worse than staying away. S3s fixed: the warning read the Night ritual instead of its ticket; it showed on Vacation days; copy. Accepted: switching today to Sick after missing both anchors pauses the day (honour system, already true before) |

Deferred: none.
