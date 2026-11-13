# QC report: M11 — push notifications + private .ics calendar link (PR #18)

| Gate | Result | Evidence |
|---|---|---|
| G1 Static | ✅ | `npm run qc:static`: typecheck, lint (0 warnings), Prettier, i18n (1060 keys EN/TH), art lint (wind chime); secrets check clean |
| G2 Functional | ✅ | Unit 355 (planner incl. the wake rollover, quiet hours, Vacation/Sick; sender core with batches; iCalendar escaping/folding); integration 261 (push: hosts, device cap, claim once with parallel runs, fairness, daily cap, relevance; ics: token, rotation, no checklists, events; setup reward; RLS loops); E2E push + ics + Today/Night/onboarding/shell (Chrome) |
| G3 Visual | ✅ (art) / ⏳ Mac baselines | Wind chime and the More cards checked at 390 px; no black, tokens only. Mac baselines as before |
| G4 UX | ✅ | Permission asked only after the tap; iPhone tab → Home Screen hint; touch targets ≥ 44 px; axe 0 serious on More; quiet hours save on blur |
| G5 Data & security | ✅ | RLS on both new tables (own select/delete only); writes through `security definer` RPCs with `search_path=''`; endpoints restricted to the browsers' push services; ≤ 10 devices; 60 reminders a day; sender functions service-role only; `.ics` reads only engine inputs (no checklists) via a 192-bit token; server-only events on the deny list |
| G6 Production | ⏳ | After merge: `db push --remote` (push, ics), the VAPID + cron setup (`docs/M11-push-setup.md`), then `npm run qc:prod` |
| G7 Independent review | ✅ PASS (round 3 at 6a763d0) | `docs/qa/M11-review.md`: round 1 FAIL (S1 R-M11-1 SSRF / queue blocking, S2 R-M11-2 wake reminder deleted) → fixed test-first; round 2 FAIL (S2 R2-1 queue flood) → fixed test-first; round 3 PASS |

Known issues (S3/S4, deferred): Today doesn't retry a failed upload offline (R-M11-3 client); "On" isn't re-checked with the server and there's no `pushsubscriptionchange` handler (R-M11-5); an endpoint can be moved without proving its keys (R-M11-6, capability URL); CJ-10 skips 02:30–10:00 Bangkok (R-M11-12); no E2E of the "on" screen (needs a VAPID build, R-M11-15); at-most-once delivery (R2-2); many accounts timing 30 reminders into the same minute could delay others by a minute or two.
