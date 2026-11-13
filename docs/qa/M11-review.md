# M11 — G7 independent review (Web Push + .ics calendar feed)

- **Scope:** `git diff origin/main..HEAD` on `m11-local` at `6094675` (draft PR #18). Covers push (subscriptions, switches, quiet hours, the uploaded plan, `push_due`, the `push-send` Edge Function, the service worker), the `.ics` feed, the notifications setup reward (wind chime), and the CJ-10 time-window skip.
- **Reviewer:** a fresh G7 subagent with no implementation context.
- **Date:** 2026-11-13.

## What I ran
| Check | Result |
|---|---|
| `npx vitest run tests/unit` | 54 files, 352/352 pass |
| `vitest` integration: push, ics, rls | 90/90 pass |
| `vitest` integration: setup-rewards, animals, story, streak | 26/26 pass |
| `tsc --noEmit`, ESLint (changed files), Prettier (changed files) | clean |
| `i18n:check` | 1059 keys, EN = TH |
| art lint | OK |
| `secrets:check` | OK |
| `next build`, in a scratch copy | OK; `/ics/[token]` is dynamic (ƒ) with `cacheComponents` |
| `next start` + curl `/ics/<token>.ics` | 200 `text/calendar`, `private, max-age=900`, `noindex`, UTC times, no Sleep; an unknown token returns 404 |
| psql probes as `authenticated` | see R-M11-1. Grants confirmed: `push_due`, `push_mark_sent`, `push_drop_endpoint`, `_setup_done` and `_setup_reward` are executable by `service_role` only; `ics_context` by anon; every new `security definer` function has `search_path=''`. |
| Wind chime at 48px and 64px, rendered next to the other decor on `/dev/art` | see R-M11-16 |

E2E (Playwright) was not run here.

## Checked and OK
- **Events deny list:** a superset of the previous one (`cafe.sql`), plus `push_subscribed`.
- **`_setup_reward` / `_setup_done`:** the latest definitions (M9 / M8) plus exactly one row each. `CREATE OR REPLACE` kept the earlier REVOKEs (verified in `pg_proc`). The SQL↔content mirror test covers `notifications`. `wind_chime` is reward-only, never in the shop.
- **RLS:** on `push_subscriptions` and `push_schedule`, clients can SELECT/DELETE their own rows only and cannot INSERT directly. `set_push_schedule` is keyed on `auth.uid()`, so a user can't put a title on another user's schedule. Anon can't subscribe.
- **ICS token:** 192-bit random (`gen_random_bytes(24)`) checked by format, then by a unique-index lookup, so guessing and timing attacks aren't practical. No user id appears in `ics_context` (a test asserts this). Rotating the link kills the old one.
- **`push_due` relevance checks match the real column semantics:**
  - Every check-in action (`upsertLog`) sets `block_logs.started_at`, `first10` included.
  - `wake_events.date` is the calendar date of the press, which is the next wake-day.
  - `night_ritual_completed.payload.date` is the ritual's wake-day, which matches `night:<day>`.
- **Permission is asked only inside the tap handler:** `requestPermission()` runs synchronously, before any `await`. The e2e test asserts nothing is asked without a tap.
- **Every push shows a notification:** `showNotification` runs inside `waitUntil`, with a fallback title.
- **Quiet hours:** a range that wraps midnight works. The check runs in the user's timezone, so it is DST-safe.
- **Refs:** unique per wake-day.
- **36 h window:** the client and server limits agree.

## Findings

| ID | Sev | Where | Failure scenario | Fix |
|---|---|---|---|---|
| R-M11-1 | **S1** | `supabase/migrations/20261113150000_push.sql:21` (endpoint check), `:68-83` (`save_push_subscription`), `:118-148` (`push_due` global `limit`). `supabase/functions/push-send/index.ts:23-28`. `supabase/functions/push-send/deliver.ts:64-78` | **Any signed-up account can turn the sender into an SSRF and DoS tool.**<br><br>The endpoint only has to start with `https://`, and there is no device cap. In psql, one user saved **600** endpoints of the form `https://10.0.0.1:8443/internal/N`, and all were accepted. Each due reminder × device becomes a POST from the Edge Function to that host. That means arbitrary hosts, private IPs included, with a body the attacker can decrypt (they supply p256dh/auth).<br><br>The send path makes this a DoS for everyone:<br>- The sender runs sequentially with no request timeout (web-push has none by default).<br>- `push_due` is capped at 500 rows globally.<br>- Rows are marked only **after** the whole loop.<br><br>So tarpit endpoints push the function past its wall clock, and nothing gets marked. Every user's due reminders are then re-sent every minute for 15 minutes, or are crowded out by the 500 cap and expire unsent. Without any attacker, overlapping cron runs (a run longer than 60 s) also double-send. | Do all four:<br>1. Allowlist push-service hosts in the save function or a CHECK: `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `*.push.apple.com`, `*.notify.windows.com`.<br>2. Cap devices per user (e.g. 10; drop the oldest).<br>3. Pass `timeout` (~10 s) to `sendNotification`.<br>4. Claim rows before sending (`update … set sent_at = now() … for update skip locked … returning`), or mark each reminder as soon as its devices are tried.<br><br>Tests first: integration tests for a rejected host and the 11th device; a unit test that a slow or throwing device doesn't stop marking. |
| R-M11-2 | **S2** | `lib/push/schedule.ts:98` (Wake block skipped; only `wake:<nextDay>` is planned). `components/push/PushPlanner.tsx:146-170`. `push.sql:103` (delete of unsent future rows) | **The "I'm up" reminder gets deleted on the morning it is needed.**<br><br>`currentDayDate` rolls to day D at the **wake target**, not at the press. When Today re-plans between the target and target+10 without a press, it uploads D's plan. That plan contains `wake:D+1` but not `wake:D`, so `set_push_schedule` deletes the pending `wake:D` (it fires at 10:10, still in the future).<br><br>Repro: notifications on, Today left open overnight on the Mac (Add to Dock) or iPad. Every morning at the target the reminder vanishes, on every device. Opening the app at 10:01–10:09 without pressing does the same. | In `planPushes`, also emit `wake:<day>` from the Wake block (`b.start + 10 min`) when it is still in the future. The server already skips it once pressed.<br><br>Test first: `plan(bkk(7,5))` contains `wake:2026-11-12`. |
| R-M11-3 | S3 | `push.sql:101-106`, `PushPlanner.tsx:149-168` | `set_push_schedule` **raises** if any item is ≤ server `now()`. A block starting during the RPC round trip, or a client clock a few seconds behind, rejects the whole day's plan. `last.current` is already set and the error is ignored, so there is no retry until the blocks or switches change. The schedule stays stale for the day. | Drop out-of-window items server-side instead of raising, or give the client a 60 s margin. Set `last.current` only after success. |
| R-M11-4 | S3 | `lib/ics/ics.ts:16`, `tests/unit/ics.test.ts:35,40` | `"\;"` in a JS string literal is just `";"`, so semicolons are **never escaped** (RFC 5545 §3.3.11). The unit test expects the same unescaped `"\;"`, so it passes. A fixed event or first-10 like "Lab; room 3" produces invalid TEXT for strict parsers. | Use `"\\;"`, and fix the test expectations to `\\;`. |
| R-M11-5 | S3 | `lib/push/usePush.ts:37-47, 107-118`, `public/sw.js`, `NotificationsCard.tsx:36-44` | "On for this device" only means a browser subscription plus permission; it is never checked against the server. Cases where it lies:<br>- `save_push_subscription` failed during Turn on (offline, expired session). The card silently returns to "ask" with no error. After a reload it shows **On**, with no server row.<br>- Someone else signed in on the device took over the endpoint.<br>- The browser rotated the subscription. There is no `pushsubscriptionchange` handler.<br><br>In each case the user sees On and gets nothing. | When the state is `on`, re-call `save_push_subscription` (idempotent) on mount. Show an error on a Turn-on failure. Handle `pushsubscriptionchange` in the SW. |
| R-M11-6 | S3 | `push.sql:78` | `save_push_subscription` moves an endpoint from another account with no proof of possession. Endpoint URLs are capability URLs, but anyone who learns one can silently take over the victim's reminders. | Move the endpoint only when `p256dh` and `auth` match the stored row; otherwise raise. |
| R-M11-7 | S3 | `supabase/migrations/20261113160000_ics.sql:45-52` | `ics_context` returns more than the feed uses:<br>- whole template rows (`to_jsonb(t) - 'user_id'`), including block checklists and `options`<br>- `settings.blocks` checklists<br>- `day_plans.overrides` (per-day checklists)<br><br>Anyone with the link, including a calendar provider's fetcher, can call the RPC directly and read them. | Strip `checklist` (and unused keys) server-side. Return only what `timelineFor` needs. |
| R-M11-8 | S3 | `PushPlanner.tsx` / `TodayScreen.tsx:199` | Vacation/Sick days still get "Focus starts now" and first-10 nudges. `tl.mode` is ignored, and a mode change doesn't change the signature, so nothing re-plans. This is at odds with the forgiving modes (SPEC §1.7, §3). | Pass the mode and plan only wake/night (or nothing) on non-normal days. Include the mode in the signature. |
| R-M11-9 | S3 | `push.sql:136-138` | A `block_start` push still fires after the block was started early. She gets "Focus starts now – Tap to start" after she already started. | Add the same `started_at` not-exists check to `block_start`. |
| R-M11-10 | S3 | `usePush.ts:121-150`, `ics.sql:20-26` | No `events` row is written for switch or quiet-hours changes, Turn off, or ICS link create/rotate. CLAUDE.md requires an event for every meaningful action; the precedents are `locale_changed` and `exercise_settings_saved`. | Write `push_prefs_saved`, `push_unsubscribed` and `ics_link_rotated` events. |
| R-M11-11 | S3 | `content/unlocks.ts:27` | The new setup step "Turn on notifications" can't be done while push is "coming soon" (no VAPID key until Minnie runs the setup) or on unsupported browsers. For a user who finished every other step, Today's compact "Set up 24/7" line comes back pointing at a step that says "coming soon". | Hide the step in the UI while `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is unset (the server still pays once it is done), or ship it together with the keys. |
| R-M11-12 | S3 | `tests/e2e/night-plan.spec.ts:137-143` | CJ-10, a critical journey, is now skipped for every run that starts between 00:00 and 10:00 Bangkok. That is ~42% of the clock, including the overnight autopilot window. | Choose the return time relative to now (e.g. now + 3 h, rounded), so the journey always runs. |
| R-M11-13 | S3 | `NotificationsCard.tsx:76-95` | Quiet-hour time inputs save on every `change` and are `disabled` while saving. An iOS wheel picker fires a change per wheel stop, which means many writes, and disabling the focused input may dismiss the picker mid-choice (not verified on a device). A half-set range (From only) silently does nothing. | Save on blur or commit, and don't disable the focused input. Show a hint when one end is empty. |
| R-M11-14 | S3 | DECISIONS 2026-11-12 ("The cat also voices … the M11 pushes"), `docs/STORY.md:14` | The push copy is generic, not in Som's voice ("Som is waiting for you"), and the deviation isn't logged. | Voice the titles in EN and TH, or log the deferral in DECISIONS (and ask Minnie). |
| R-M11-15 | S3 | tests | Coverage gaps:<br>- No E2E of the **on** state (switches and quiet hours: touch targets, axe, TH, dark).<br>- No test of the `PushPlanner` mapping (titles and bodies, TH, when it re-uploads).<br>- No wake-rollover test (R-M11-2).<br>- No test that a slow device doesn't block the others.<br>- No ICS route test for TH, fixed-event labels or escaping. | Add these with the fixes above. |
| R-M11-16 | S4 | `components/art/farm/Festival.tsx:243-266` | Wind chime rubric: R1 4, R2 4, R3 4 (borderline).<br>- It is the faintest item in the decor row: pale blue and near-white tubes on cream.<br>- The post and bar are single-tone (no shadow tone).<br>- The clapper and sail are drawn over the post. | Add a darker-blue shadow strip on the tubes and a wood-light highlight on the bar. |
| R-M11-17 | S4 | `app/ics/[token]/route.ts:43-46, 52, 59` | - The feed starts at the calendar date, so between midnight and wake the current wake-day's after-midnight Down is missing.<br>- UIDs `<date>-<key>@247` aren't globally unique across users.<br>- Vacation/Sick days are listed like normal days. | Start the loop at `i = -1` (past events are already filtered out). Add a per-user hash to the UID. |
| R-M11-18 | S4 | `push.sql`, `index.ts:13`, `sw.js`, `messages/*.json` | - Missed-window rows stay `sent_at null` forever.<br>- 403/413/429 failures are marked sent and the device is never flagged.<br>- `Bearer ${undefined}` would match if the env var were missing (the gateway JWT check covers this).<br>- The SW url check allows `//host` (the url is server-set, so moot).<br>- The "blocked" text says "phone's Settings" on a Mac.<br>- `push-send/index.ts` is excluded from `tsc` and not `deno check`ed. | Log only. |

## Verdict
**FAIL.** There is 1 open S1 (R-M11-1) and 1 open S2 (R-M11-2). The S3/S4 findings can be fixed now or logged as Known issues. After R-M11-1 and R-M11-2 are fixed test-first, re-run G7.


## Fixes (2026-11-13, after round 1)
| ID | Status |
|---|---|
| R-M11-1 (S1) | Fixed test-first: endpoints only on the browsers' push services (FCM, Mozilla, Apple, WNS; CHECK constraint); at most 10 devices per account (oldest dropped); the sender claims reminders with `push_claim` (`for update skip locked`, marked sent before sending, so parallel runs and slow devices never resend or block); sends in parallel batches of 20 with a 10 s timeout per request. Integration + unit tests. |
| R-M11-2 (S2) | Fixed test-first: `planPushes` also plans `wake:<day>` from the Wake block while it's ahead, so a re-plan after Today flips at the target keeps it. |
| R-M11-3 | Fixed: an item that became due during upload is dropped, not the whole plan (tested). |
| R-M11-4 | Fixed: `;` is escaped as `\;` (the test now expects the right value). |
| R-M11-5 | Partly: Turn on says so when the browser allowed it but saving the device failed. Server check of "On" and `pushsubscriptionchange` deferred (S3). |
| R-M11-6 | Accepted (S3): push endpoints are unguessable capability URLs; moving one needs that URL. |
| R-M11-7 | Fixed: the link's context carries no checklists (settings, templates, day-plan overrides); tested. |
| R-M11-8 | Fixed: Vacation/Sick days get no block nudges (tested). |
| R-M11-9 | Fixed: a block-start push is skipped once the block started (shared `_push_wanted`; tested). |
| R-M11-10 | Fixed: `push_prefs_changed`, `push_turned_off` (client) and `ics_link_made` (server-only) events. |
| R-M11-11 | Fixed: the notifications setup step is offered only when push is configured (VAPID key in the build). |
| R-M11-12 | Narrowed: CJ-10 skips 02:30–10:00 only (≈ 31% instead of 42%). |
| R-M11-13 | Fixed: quiet hours save when the field is left, never disabled mid-edit. |
| R-M11-14 | Fixed: push bodies are in Som's voice (EN/TH). |
| R-M11-15 | Partly: planner rollover, claim and .ics context covered; an E2E of the "on" screen needs a VAPID build (deferred). |
| S4s | Accepted. |

## Round 2 (2026-11-13, `git diff 6094675..3fab63a`)

### What I ran
| Check | Result |
|---|---|
| Unit tests | 355/355 pass |
| Integration: push, ics, rls, setup-rewards | 97/97 pass |
| `tsc`, ESLint + Prettier on changed files, `i18n:check` (1060 keys) | clean |
| Endpoint CHECK, probed in psql as `authenticated` | see table below |
| 10-device cap | 12 saves leave 10, the newest kept |
| `push_claim`, two sessions in parallel | A claims 5 rows and holds them uncommitted; B gets 0 (`skip locked`); a third claim after commit gets 0. All 5 marked sent. `authenticated` gets "permission denied". |
| `/ics` route handler run directly on the new `ics_context` (checklists stripped) | 200, normal events |
| Flood probe | see R2-1 |

Endpoint CHECK probe results:

| Endpoint | Result |
|---|---|
| FCM, Mozilla, `web.push.apple.com`, `wns2-…notify.windows.com` | accepted |
| `fcm.googleapis.com@evil.com` | rejected |
| `evil.com@fcm.googleapis.com` | rejected |
| `:8443` port | rejected |
| `FCM.` (upper case) | rejected |
| trailing dot `fcm.googleapis.com.` | rejected |
| `fcm.googleapis.com.evil.com` | rejected |
| `evil.com/fcm.googleapis.com/` | rejected |
| `fcm.googleapis.com\@evil.com` | rejected |
| `a.b.push.apple.com` | rejected |
| `https://10.0.0.1/` | rejected |
| `xn--….push.apple.com` | accepted, but still Apple's domain |
| `fcm…/x\nhttps://evil.com/` and `fcm…/x#@evil.com` | accepted, but the host still parses as FCM |

The `[a-z]` ranges are ASCII-only and case-sensitive (checked).

### Round-1 findings re-checked
| ID | Round 2 |
|---|---|
| R-M11-1 (S1) | **SSRF part fixed and verified:** host allowlist, 10-device cap, claim-before-send with `skip locked`, batches of 20, 10 s per-request timeout. **The queue-DoS part is still open → R2-1.** |
| R-M11-2 (S2) | **Fixed.** `wake:<day>` is planned from the Wake block. Same ref as the night-before plan, so `on conflict` updates it; once past, it isn't re-planned or deleted (the delete only touches `fire_at > now()`). Unit-tested. |
| R-M11-3 | Server part fixed (a late item is dropped, tested). The client still sets `last.current` before the RPC and ignores errors, so an offline upload isn't retried until the blocks or switches change. S3, Known issue. |
| R-M11-4 | Fixed. The test now expects `\;`. |
| R-M11-5 | Partly fixed (error message on a failed save). The server check of "On" and `pushsubscriptionchange` are deferred. S3, Known issue. |
| R-M11-6 | Accepted as S3. |
| R-M11-7 | Fixed. Checklists are stripped from settings, templates and overrides; tested; the route still renders. |
| R-M11-8 | Fixed. Mode is passed and is part of the signature; tested. |
| R-M11-9 | Fixed via `_push_wanted`; tested. |
| R-M11-10 | Fixed. `ics_link_made` is server-only (added to the deny list; a client insert is refused, tested). `push_prefs_changed` and `push_turned_off` are client-written; that is fine, since no reward or `_setup_done` reads them. |
| R-M11-11 | Fixed. `OFFERED_STEPS` hides the step without a VAPID key; it is the only consumer of `SETUP_STEPS` in the UI. |
| R-M11-12 | Narrowed to a 02:30–10:00 skip (~31%). S3, Known issue. |
| R-M11-13 | Fixed: local state, save on blur, inputs are never disabled. |
| R-M11-14 | Fixed: Som's voice in EN and TH. |
| R-M11-15 | Partly fixed (E2E of the "on" screen deferred). S3, Known issue. |

### The coordinator's questions
- **Claimed-but-unwanted rows silently marked sent: OK.** That is the intended "skip, never resend" behavior, the same as before, and it is evaluated at fire time. The one trade-off is at-most-once delivery: a claimed send that times out or gets 429/5xx is never retried (R2-2).
- **Events:** OK (see R-M11-10 above).
- **`_ics_blocks`:** correct.
  - A non-object returns unchanged.
  - JSON `null` stays JSON `null`, so `jsonb_set` never gets SQL NULL; `templates.blocks` is NOT NULL.
  - It is revoked from clients and runs only inside `ics_context`.
  - Sub-slot labels (e.g. "gym") still go out. They're part of the plan; acceptable.

### New / remaining findings
| ID | Sev | Where | Failure scenario | Fix |
|---|---|---|---|---|
| R2-1 (R-M11-1 residual) | **S2** | `push.sql` `set_push_schedule` (no per-user volume limit), `push_claim` (global `order by fire_at limit 200`, no per-user fairness, picks rows of users with no devices) | **One signed-up account, with no devices at all, can still block reminders for everyone.**<br><br>Repro: `set_push_schedule` with 24 fresh refs at `now()+1s`, repeated. Rows that have become due are never deleted by the next upload. 5 calls 1.2 s apart left **120 due, unsent rows**, so a 1 call/s loop makes about 1,440 rows/min.<br><br>`push_claim` drains only 200/min, oldest first, across all users. Everyone else's reminders sit behind the backlog and fire up to ~15 min late, or drop out of the window unsent. Sent rows are never cleaned up, so the table also grows by about 2 M rows/day. | 1. **Cap per user in `set_push_schedule`:** e.g. raise if, after insert, the user has more than ~60 rows with `fire_at > now() - 24 h` (real use is about 12 a day).<br>2. **Fairness in `push_claim`:** `row_number() over (partition by user_id order by fire_at) <= 30` before the global limit, and pick only users who have a device.<br>3. **Housekeeping:** delete the user's sent or expired rows older than 2 days in `set_push_schedule`.<br><br>Test first: an integration test where a looped `set_push_schedule` is refused past the cap, and a test where a flood from user A doesn't keep user B's due reminder out of one `push_claim`. |
| R2-2 | S4 | `push_claim` + `deliver.ts` | At-most-once delivery: a timed-out or 5xx send, or a crash after the claim, loses that reminder. This is a fair trade for never double-sending. | Log as a Known issue. |
| R2-3 | S4 | `NotificationsCard.tsx` `onBlur` | Both blur handlers build the update from the `prefs` closure. If "To" is committed before the "From" save resolves (fast keyboard tabbing), the second save writes back the old `quietStart`. | Save `{start, end}` from the local `quiet` state together. |
| R2-4 | S4 | `app/ics/[token]/route.ts` | Malformed settings (a block missing; seen with a test user's one-block settings) make the engine throw (`invalid duration for down`), so the feed returns a bare 500. Pre-existing, but now reachable through a public URL. | Wrap the planning in try/catch and return 503. |
| R2-5 | S4 | `SetupCard.tsx:14-21` | `const OFFERED_STEPS` sits between import statements. | Move it below the imports. |

### Round 2 verdict
**FAIL**, with one open **S2: R2-1** (one account can still flood the shared push queue). R-M11-1's SSRF part and R-M11-2 are fixed and verified. The other round-1 items are fixed or accepted as S3/S4 Known issues. Fix R2-1 test-first, then a short re-check of `set_push_schedule` / `push_claim` is enough.


## Fixes after round 2 (2026-11-13)
| ID | Status |
|---|---|
| R2-1 (S2) | Fixed test-first: `set_push_schedule` refuses uploads past 60 reminders in 24 h and deletes the user's rows older than 2 days; `push_claim` picks only users with a device and at most 30 per user per run (`row_number()` in a CTE, then `for update skip locked` with the due checks re-applied). Integration test: a looping uploader is refused, a device-less user is never picked, one user gets ≤ 30 per run. |
| R2-2 (S4) | Accepted: at-most-once delivery (a timed-out send isn't retried); logged. |
| R2-3 (S4) | Fixed: leaving either quiet-hours field saves both from the local edit. |
| R2-4 (S4) | Fixed: a malformed plan gives `/ics` a 503, not a bare 500. |
| R2-5 (S4) | Fixed: the const moved below the imports. |
