# QC report: review fix Phase B — front door, in-app browser note, Google sign-in (off)

Plan: `docs/REVIEW_FIX_PLAN.md` Phase B (B1–B3).

| Gate | Result | Evidence |
|---|---|---|
| G1 Static | ✅ | typecheck, lint, Prettier, i18n (1267 keys, EN = TH), art lint |
| G2 Functional | ✅ Chrome locally / ⏳ WebKit in CI | Unit + integration 716. New unit tests: only `/` is public (exact match), in-app browser detection (LINE, Instagram, Facebook, TikTok, X, Threads, WeChat, Android WebView; Safari, Chrome and the installed app are left alone), the Google switch, why a sign-in came back unfinished. E2E on Chrome: 140 passed, 2 skipped. New: the front door in EN and TH, `/plan` still needs an account, signed-in `/` → Today, the in-app note on the front door and the login page, the Google button absent with the switch off, a cancelled sign-in says so, reduced motion has no hydration error. |
| G3 Visual | ✅ looked at | The front door at 390 px in TH and EN. No Mac baseline exists for it yet. |
| G4 UX | ✅ | One way in ("Start free"), 44 px targets, a two-line headline that breaks between its two ideas, the farm still under reduced motion and "skip animations", the note inside in-app browsers with a copy fallback. |
| G5 Data & security | ✅ | G7 probed 39 path variants signed-out against the built app: only `/` is public; the rest redirect to `/login`. `/` is the same static page for everyone and holds no user data. The OAuth redirect is the app's own origin plus a fixed path; the callback redirects only to fixed paths. No key in git. |
| G6 Production | ⏳ | After merge: `npm run qc:prod`; open the site signed-out; open a link from LINE. Google stays off until Minnie follows `docs/GOOGLE-LOGIN-SETUP.md`. No migration. |
| G7 Independent review | ✅ PASS (round 1, no S1/S2) | `docs/qa/REVIEW-B-review.md`. Fixed after: R-B-1 (Back after sign-in leaves the front door for Today), R-B-2 (reduced motion read after hydration), R-B-3 (the in-app note on the login page too), R-B-4 (more in-app browsers), R-B-5 (copy fallback and an announced result), R-B-6 (a cancelled or failed Google sign-in has its own message), R-B-7 (setup checklist: the Home Screen app, the redirect list, "should link"), R-B-9 (the button is busy while leaving), R-B-11 (Thai wording), R-B-12 (the "skip animations" setting). |

Known issues (S3/S4, deferred):
- **R-B-6 (rest):** with the switch on and the provider not enabled in Supabase, the button leads to a bare error page. The setup guide orders the steps so this can't happen if followed.
- **R-B-8:** a sign-in that falls back to the site address (`/?code=…`) ends on the front door without a message.
- **R-B-10:** the switch-on path was checked by hand once (button shown, goes to Supabase's Google address), not in CI.
- **R-B-12 (rest):** before JavaScript runs the scene shows bare soil; with the in-app note, "Start free" may sit below the fold on a 375 px phone (not measured).
- **R-B-13:** `?from=` isn't recorded anywhere yet.
- **Not checked here:** a real Google sign-in and account linking (no credentials), a real LINE or Instagram in-app browser.
