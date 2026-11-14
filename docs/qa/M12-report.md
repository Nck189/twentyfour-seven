# QC report: M12 — share free times + booking requests (PR #20)

| Gate | Result | Evidence |
|---|---|---|
| G1 Static | ✅ | `npm run qc:static`: typecheck, lint, Prettier, i18n (1110 keys EN/TH), art lint; secrets check clean; the service-role key never in `.next/static` (G7 round 2 grep) |
| G2 Functional | ✅ | Unit 372 (free/busy math, a slot stays on its wake-day's date for wakes 07:00–13:00, `slotFits`, an accepted booking doesn't move the wake, `.ics` lone CR); integration 93 (share: server-only RPCs, link/rotate/off, privacy, request validation incl. control/zero-width/bidi + Thai names, `p_day`, rate limit, accept/decline once, no accept after the time; RLS/export loops); E2E CJ-SHARE-1..3 + the More-related specs (Chrome locally; iPhone/WebKit in CI) |
| G3 Visual | ✅ (390 px) / ⏳ Mac baselines | Public page, request form and the More card checked at 390 px (TH and EN); tokens only, no black; the picture uses the UI tokens |
| G4 UX | ✅ | Touch targets ≥ 44 px; labelled selects/inputs; `status`/`alert` roles; "Sent!" shown in place; Accept/Decline named with the requester; past / no-longer-free requests can only be declined; Copy and Share run inside the tap (iOS) |
| G5 Data & security | ✅ | RLS forced on `share_links` and `booking_requests` (own select only, no client writes); engine inputs and `request_slot` are `service_role` only, called by the Next server (`server-only`); the browser gets intervals only; a request must lie inside the recomputed free time; 192-bit token, rotate/stop; 5/h and 20/day per owner under an advisory lock; server-only events on the deny list |
| G6 Production | ⏳ | After merge: `SUPABASE_SERVICE_ROLE_KEY` on Vercel + `db push --remote` (share) + redeploy (`docs/M12-share-setup.md`), then `npm run qc:prod` and open a share link once |
| G7 Independent review | ✅ PASS (round 2 at fdece3e) | `docs/qa/M12-review.md`: round 1 FAIL (S1 R-M12-1 engine inputs readable through the public RPC; S2 R-M12-2 after-midnight slots on the wrong day, R-M12-3 stale start, R-M12-4 no server free check, R-M12-5 iOS copy after await) → fixed test-first; round 2 PASS; R2-2/-3/-4 fixed after |

Known issues (S3/S4, deferred):
- **R2-1:** Free time after local midnight isn't shared. A late wake (11:30–13:00) shares fewer days. Fixing it needs engine support for fixed events after midnight.
- **R-M12-11:** there's no badge or push for new requests.
- **R-M12-14:** sub-slots inside Free and sick/vacation days show as free. This is waiting on Minnie.
- **R2-5:** the server action computes free time before the rate limit runs, and there's no per-IP limit.
- **R2-6:** with no service-role key, links silently show not-found.
- **S4s:**
  - the picture doesn't wrap long lines;
  - the token appears in the data export;
  - first-use race in `share_link`;
  - a link that doesn't exist returns HTTP 200 (`noindex`).
- **Copy on iPhone:** should be confirmed on a real device after merge.
