# QC report: rules B + C — choose the blocks you track; adjust the day on Today

Minnie OK'd these on 2026-11-27. See DECISIONS ("Rule B", "Rule C") and SPEC §8.4 (rule A, which this builds on).

| Gate | Result | Evidence |
|---|---|---|
| G1 Static | ✅ | `npm run qc:static`: typecheck, lint, Prettier, i18n (EN = TH), art lint |
| G2 Functional | ✅ | vitest 800/800. New integration tests: `set_block_tracked` dates a change from the next wake-day (from today only during setup); the keep-log trigger stops a stale copy from undoing a change or backdating it; the Day score reads the setting per day; re-tracking a block never takes back growth. Local E2E Chromium: full suite green (new `tracked-blocks.spec`; onboarding and first-day updated for the new step) |
| G3 Visual | ⏳ Mac baselines | New onboarding step, More → Set up card, Today's Adjust fold and Next line. Re-record with the batch |
| G4 UX | ✅ | Untracked blocks keep their time with "Check in anyway". The Adjust fold is closed by default. "Not today" is offered only before a block starts, with Undo. A stretch that would change nothing says so. Touch targets ≥ 44 px; regions named |
| G5 Data & security | ✅ | Migration `20261128010000`: `_untracked_on`, `_day_oee`, `_plot_harvest`, RPC `set_block_tracked` (`security definer`, `search_path=''`, `auth.uid()`), trigger `settings_keep_tracked_log`. The Day score and harvest stay server-side. The dated log is written only by the RPC |
| G6 Production | ⏳ | Before merge, Minnie runs `npx supabase db push --remote` (1 migration). After merge: `npm run qc:prod` |
| G7 Independent review | ✅ PASS on re-review | First review FAILED with 3 S2s, all fixed: "Not today" was offered after a block had started; +15/+30 on Free did nothing; the tracked setting applied to past days, so re-tracking could un-ripen a crop. S3s fixed: the card after "Check in anyway"; onboarding Back and save errors; nudge and card errors; 44 px link; starting a block set aside counts it again; no Undo on blocks with no time |

Accepted / deferred:
- "Before it starts" for "Not today" is checked in the app only. The server can't know a block's planned start, since that's client-computed and timing is honour-system per DECISIONS.
- Onboarding saves the 4 choices one RPC at a time. A failure mid-way shows the error, and retrying saves them all.
- Giant crops need a successful block, so they never merge on untracked plots (cosmetic).
