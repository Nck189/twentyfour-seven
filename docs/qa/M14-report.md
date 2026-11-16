# QC report: M14 — Polish (PRs #23, #24, #25)

| Gate | Result | Evidence |
|---|---|---|
| G1 Static | ✅ | typecheck, lint, Prettier, i18n (EN = TH), art lint (20 files, 73 tokens), secrets check clean |
| G2 Functional | ✅ | Unit (692 incl. integration): estimates, presets, retention, pending saves (final-code list, replay decisions, try count), week share (logged days, 7-day window), picture token inlining (nested fallbacks). Integration: `delete_my_account` (cascade over every exported table, anon refused), `actual_min` check. E2E (Chrome locally, iPhone/WebKit in CI): offline queue (persist + replay, refused head never stalls, restored baseline), delete account, admin page, week share download, actual-time prompt, CJ-STATE-1/2. |
| G3 Visual | ✅ (390 px) / ⏳ Mac baselines | Every screen at 390 px in EN and TH, light and dark, for the states audit. The week picture was checked as a PNG (EN light, TH dark): no black, soft shadows, Thai font loaded. The new seed art was checked at 48 and 120 px. |
| G4 UX | ✅ | Empty, loading and error states on every screen (`docs/qa/M14-states-audit.md`). Touch targets ≥ 44 px. More's cards are named regions. Alerts use `role="alert"`. Reduced motion is respected (unlock pop-in, egg reveal). |
| G5 Data & security | ✅ | `delete_my_account` is security definer with `search_path=''`, `auth.uid()` only, revoked from anon, and not CSRF-able. The admin page is server-only: `ADMIN_EMAILS` is server env and only totals reach the browser. Offline queue: stored per user and RLS-checked on replay; tampering only hurts yourself. The week picture holds no tasks, names or times. |
| G6 Production | ⏳ | Minnie: `db push --remote` (`actual_minutes`, `delete_account`, plus share/factory if missing), set `ADMIN_EMAILS` on Vercel, redeploy, then `npm run qc:prod` |
| G7 Independent review | ✅ after fixes | `docs/qa/M14-review.md`, round 1 FAIL with 4 S2s + 1 deploy check. All fixed test-first: R-M14-1/2 (queue), R-M14-3 (logged days), R-M14-4 (the farm picture, as specified). R-M14-5 is a deploy check for Minnie (see G6). Also fixed: R-M14-11 (replay race and per-save persist), R-M14-13 (privacy wording), R-M14-14 (estimates), R-M14-15 (fonts before drawing, delayed revoke). |

Known issues (S3/S4, deferred):
- **R-M14-6:** retention counts today as a finished day (so the newest cohort reads low), and uses Bangkok time for everyone.
- **R-M14-7:** retention reads events page by page (fine for the pilot); move it to a service-role SQL function before ~1000 users.
- **R-M14-8:** "active" means any event, not GROWTH's "I'm up + Night ritual"; a visitor's booking counts the owner.
- **R-M14-9:** the admin check trusts the email. Hosted "Confirm email" must stay on, or switch to an admin user id.
- **R-M14-10:** late or refused check-ins aren't explained on screen (the anti-cheat trade-off is logged in DECISIONS).
- **R-M14-12:** pending saves and the push subscription stay on the device after sign-out or deletion.
- **R-M14-16:** focus and announcements (delete confirm focus, the actual-time prompt for VoiceOver, the prompt under an open sheet).
- **R-M14-17:** the queue E2E skips WebKit (route interception); retention has no partial-day or timezone tests.
- **R-M14-18:** S4 nits.
- **States audit:** the Collection book, streak chip and café toggle hide or disable on a partial load failure.
