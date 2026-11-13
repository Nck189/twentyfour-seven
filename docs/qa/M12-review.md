# M12 — G7 independent review (share availability + booking)

- **Scope:** `git diff 92293db..HEAD` on `m12-local` at `7502eed`. Covers the public `/share/<token>` page (`app/share/[token]/page.tsx`, `components/share/ShareView.tsx`), the More card (`components/settings/ShareCard.tsx`), `lib/share/freebusy.ts` + `compute.ts`, migration `20261113180000_share.sql`, export tables, and the tests.
- **Reviewer:** a fresh G7 subagent with no implementation context.
- **Date:** 2026-11-13.

## What I ran
| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| ESLint and Prettier on the changed TS/TSX/JSON/MD files | clean |
| `i18n:check` | 1099 keys, EN = TH |
| `art:lint` / `secrets:check` | OK / OK |
| `npx vitest run tests/unit` | 57 files, 368/368 pass |
| `vitest` integration: `share.test.ts` + `rls.test.ts` | 91/91 pass |
| `pg_proc` probe | All 4 RPCs are `security definer` with `search_path=""`. `share_context` and `request_slot` are executable by anon + authenticated. `share_link` and `answer_booking` are authenticated only. `_share_blocks` and `_share_events` are not executable by clients. |
| Live probes against local Supabase (scratch scripts using the integration helpers) | See R-M12-1, -2, -6 |
| Engine probes (`timelineFor` / `freeDaysFromContext` with the default templates; scratch `tsx`) | See R-M12-2 and R-M12-4 |

E2E (Playwright) was not run here.

## Checked and OK
- **RLS:** `share_links` and `booking_requests` have RLS enabled and forced. Clients can SELECT their own rows only, with no INSERT/UPDATE/DELETE grant. Another user and anon read `[]`, and a direct insert is refused (integration test plus my probe).
- **`answer_booking`:**
  - It is keyed on `auth.uid()` and locks the row with `for update`. Another user gets P0002, and a second answer gets P0001.
  - If the day plan doesn't exist yet, `patch_day_plan` creates it.
  - A repeat add of the same id is a no-op (`booking-<id>`).
- **Token:** 192-bit random. It is format-checked before a unique-index lookup. Rotating it kills the old link. The 48-hex check in the page and the RPC match.
- **Events deny list:** an exact superset of the previous definition (`push.sql`), plus `share_link_made`, `booking_requested` and `booking_answered`. Nothing was dropped (I diffed the lists). Server-side events are written for link make/rotate, request and answer. The `booking_requested` payload holds only the id, so the visitor's name and note stay out of events.
- **Rate limit:** the count runs after a per-owner advisory xact lock, so concurrent requests serialize and the 6th in an hour is refused.
- **Account deletion and export:** both new tables `on delete cascade` from `auth.users`, and both are in `EXPORT_TABLES`.
- **Time checks in `request_slot`:** the "one local day" check uses the profile timezone and `end - 1s`, so it is DST-safe.
- **Free/busy math:**
  - `subtract` handles edges, containment and overlapping cuts.
  - The 30-min minimum and the clipping to now work.
  - The `nextMidnight` hour-step + minute back-off is correct for :30/:45 zones and DST.
- **Day loop:** `i = -1..13` creates no duplicates (a wake-day's Free never overlaps the next one's). The `day_plans` window (today-2 … today+15) covers `timelineFor(today+13)`, which needs D+1 and D+2.
- **Project rules:**
  - No hardcoded user strings.
  - Touch targets use `min-h-11` (44 px).
  - Selects and inputs are labelled; errors use `role="alert"` and success messages `role="status"`.
  - The canvas picture uses only UI tokens (no black).
  - The page has `noindex`, and `/share` is in `PUBLIC_PATHS`.

## Findings

| ID | Sev | Where | Failure scenario | Fix |
|---|---|---|---|---|
| R-M12-1 | **S1** | `supabase/migrations/20261113180000_share.sql:86-114` (`_share_blocks` / `_share_events` strip only `checklist`, `first10` and `title`), `:146` (whole template rows), `:150-160` (`mode`, `late_night`, `bedtime_override`, raw `overrides`), `:259` (anon grant) | **Anyone with the link can read the owner's private plan data, not just free/busy.**<br><br>`share_context` is a public RPC: the token is in the URL and the anon key is in the JS bundle. It returns the engine inputs filtered by a **deny** list, so everything not on that list leaks. Probe as anon on a fresh user (`share_context` JSON contained each item):<br>- per-day **sub-slot task labels** (`overrides.blocks.work.sub_slots[].label = "SECRET_SUBSLOT therapy"`)<br>- template sub-slot labels<br>- the user's **own first-10 texts** (`settings.blocks[].first10_options`)<br>- `mode: "sick"` / `"vacation"` per day<br>- `bedtime_override` and `late_night.return_at`<br>- fixed-event `key` and `id` (e.g. `relatives_dinner`, `family_out`, custom ids)<br>- template `key` and `options`<br><br>The page footer promises "never what the plans are". The integration test only checks `checklist`, `first10` and `title`. | Use an **allowlist**, not a deny list, or don't expose engine inputs at all:<br>(a) **Preferred:** grant `share_context` to `service_role` only and call it from the server page with a server-only key, so only the computed intervals ever leave the server.<br>(b) Otherwise build each object field by field:<br>- blocks: `{key, duration_min}`<br>- templates: `{id, weekdays, auto_apply, target_wake, options: {attend_toggle, alt_target_wake}, blocks: {k: {duration_min}}, fixed_events: [{id: ordinal, start, end, host}]}`<br>- day_plans: `{date, template_id, attending, bedtime_override, late_night: {return_at}, overrides: {blocks: {k: {duration_min}}, fixed_events: [...]}}`<br>Drop `mode`, `sub_slots`, `first10_options` and `key`.<br><br>**Failing test first:** in `share.test.ts`, set `first10_options`, a `sub_slots` label, `mode: 'sick'` and an event key `relatives_dinner`, then assert that none appears in `JSON.stringify(ctx)`. |
| R-M12-2 | **S2** | `lib/share/freebusy.ts:58` (cut at the midnight after `free.start`), `lib/share/compute.ts:36`, `share.sql:198` (`p_day` may be start-1), `:244-247` (HH:MM on `r.day`) | **Free time after local midnight lands on the wrong day, and accepting it wrecks the day.**<br><br>The engine reads fixed-event `HH:MM` on wake-day **D's calendar date** (`zonedInstant(date, min)`). Times after midnight can't be expressed; only `end <= start` wraps.<br><br>`freeForDay` clips at the midnight after `free.start`. When the Free block **starts** at or after 00:00, the whole after-midnight Free is offered under date D. Repro with default blocks and a 11:30 weekday wake: 2026-11-13 offers `14/11 00:00–01:00`.<br><br>Consequences:<br>1. The page and the copied text say "Friday 13 November 00:00–01:00", but it is Saturday 00:00. Friends come a day early.<br>2. Accept → `patch_day_plan('2026-11-13', start '00:00')` → the engine puts the event at **13/11 00:00**. Probe result: wake 04:00, Focus 0, Gradation 0, Sleep 0 min, warnings `fixed_event_conflict 540` and `short_sleep 0`.<br><br>The same happens through the `i = -1` path, and through a direct `request_slot` with `p_day = start - 1`. My probe sent a 04:00 Nov 15 slot with `p_day = 2026-11-14`; it was accepted and landed as `"04:00"` on Nov 14. | Make a slot always sit on the calendar date of its wake-day:<br>- Clip Free at `zonedInstant(addDays(date, 1), 0, tz)` (the midnight that ends D), not the midnight after `free.start`.<br>- In `request_slot`, require `p_day = (p_start at time zone tz)::date`. Drop the `- 1` allowance.<br><br>**Tests first:**<br>- Unit: `freeDaysFromContext` with an 11:30 wake returns no interval whose local date ≠ `d.date`.<br>- Integration: `p_day = start - 1` → 22023.<br>- Unit: `timelineFor` with an accepted `booking-*` event keeps the wake at its target and has no `fixed_event_conflict`. |
| R-M12-3 | **S2** | `components/share/ShareView.tsx:80-92, 130-132` | **The request is sent for a different time than the one the visitor picked.**<br><br>`RequestForm` has no `key`, so tapping a second chip on the **same day** reuses the mounted form. `useState(starts[0])` keeps the first chip's start, and the select shows chip B's options with a value that isn't among them. Send submits chip A's time.<br><br>When A is after B, `lengths` is empty, so the length select is blank and 30 min is sent at A's start. Days with two gaps are common (any fixed event inside Free, or an already accepted booking). | Add `key={open.start}` to `<RequestForm>`, or reset `at` with an effect when `start` changes.<br><br>**Test first:** an E2E (or RTL) test that taps the 2nd chip of a two-gap day after the 1st, sends, and asserts the request row's `start_at` is inside the 2nd gap. |
| R-M12-4 | **S2** | `share.sql:192-199` (no free check), `:245` (`host: 'free'` hard-coded) | **A request outside the Free block re-flows the owner's whole day when accepted.**<br><br>The server error says "pick a time from the free slots", but `request_slot` never checks that the slot is free. Accept always adds the event with `host: 'free'`.<br><br>Probe: default Friday plus an accepted 14:00–15:00 booking. Wake moves 10:00→**09:00**, Focus 0, Work 09:30–14:00, Free 14:00–16:30, then an **8.5 h hole** until Down at 01:00, and `short_sleep`.<br><br>This happens for:<br>- a visitor who calls the RPC directly (any time within 15 days, 03:00 included)<br>- a legitimate request that went stale because the owner later changed the kind of day<br><br>The inbox gives no hint that the slot is no longer free. | Decide outcomes on the server:<br>- Route the request through a server action on `/share/[token]` that recomputes `freeDaysFromContext` and only then calls a `service_role`-only `request_slot`. The slot must lie inside one free interval.<br>- On accept, compute the current timeline on the client and warn when the slot isn't inside Free. Pass the containing block as `host`; the server checks it against the block keys.<br><br>**Tests first:**<br>- Integration: a slot inside Work or Sleep is refused.<br>- Unit: an accepted booking never moves the wake. |
| R-M12-5 | S2 (iPhone-only; confirm on a device) | `components/settings/ShareCard.tsx:150-182` | **"Copy free times" (and the picture) likely fail on iPhone.**<br><br>Both handlers `await freeDays()` (a Supabase round trip) and then call `navigator.clipboard.writeText` / `navigator.share`. WebKit requires these to run inside the user gesture, and the gesture is lost across a network await. Expect `NotAllowedError`.<br><br>The user then sees "Couldn't send. Try again." (the wrong copy for a copy action, see R-M12-16). This is the LINE flow SPEC §9 asks for. Desktop Chrome passes. | Load the free days when the card mounts (or when it scrolls into view), so the tap handler calls `writeText` synchronously. Alternatively use `navigator.clipboard.write([new ClipboardItem({"text/plain": textPromise})])`, which Safari supports. Pre-render the PNG before the share tap.<br><br>Add an E2E on the WebKit iPhone project that taps Copy and reads the clipboard (or at least asserts no alert). |
| R-M12-6 | S3 | `share.sql:179-189` | **Visitor names and notes accept control and invisible characters.**<br><br>`btrim` trims spaces only. Probe: the RPC accepted these names:<br>- `"​"` (zero-width only)<br>- `"\t"`<br>- `"Ploy\r\nBEGIN:VEVENT"`<br><br>The result is blank-looking inbox rows and appointments. Bidi overrides can spoof the "Name · day time" line. The name becomes the fixed-event title, which flows into the `.ics` feed, where `icsText` escapes `\r?\n` but not a lone `\r`. | Reject `[\x00-\x1F\x7F​-‏‪-‮⁦-⁩]` in the name and the note (newline allowed in the note only). Trim with `regexp_replace(..., '^\s+|\s+$', '')`. Require at least one letter or digit. Also escape a lone `\r` in `icsText`. |
| R-M12-7 | S3 | `share.sql:221-252`, `ShareCard.tsx:196-233` | **Stale and conflicting requests can be accepted.**<br>- Requests whose time has passed stay "pending" forever with an Accept button. Accepting adds an appointment to a past day.<br>- Two pending requests for overlapping times can both be accepted, a silent double-booking. | Refuse accept when `end_at <= now()`, and show such requests as "expired" (or auto-decline them). On accept, warn when an accepted booking overlaps. |
| R-M12-8 | S3 | `ShareCard.tsx:40-44` | **Genuine requests can drop out of the inbox.**<br><br>The inbox query is `limit(20)` over all statuses, newest first. A spammer with the link can send 20 a day, which pushes older genuine pending requests out of view. There is no paging. | Query pending with no limit (or a high one) and answered requests separately (last 5). |
| R-M12-9 | S3 | `ShareCard.tsx:33, 52-56` | **Inbox times use the wrong timezone for non-Bangkok users.**<br><br>Inbox times are formatted with the `tz` state. It starts as `Asia/Bangkok` and changes only after the user taps Copy or Picture. Users in another profile timezone see wrong request times. | Load the profile timezone on mount. |
| R-M12-10 | S3 | `share.sql:8-19` and the card | **Sharing can't be turned off.**<br><br>"Make a new link" just makes another live link, and there is no delete policy or RPC. A user who wants to stop sharing has no way to. | Add a `share_link_off()` RPC that deletes the row and writes an event, plus a "Stop sharing" button. |
| R-M12-11 | S3 | ShareCard / navigation | **The owner isn't told about new requests.**<br><br>There is no badge, push or Today hint; they sit in More until she happens to open it. SPEC §9's "pending → owner accepts" depends on her noticing. | Add a count badge on the More tab, or a push type (M11 infrastructure exists). Or log the deferral in DECISIONS. |
| R-M12-12 | S3 | `ShareView.tsx:129` | **One fallback start always fails.**<br><br>When a gap has no aligned 30-min start (e.g. it starts at "now" 22:37 and ends at 23:10), the fallback start is `from`, the page-load instant. By the time she taps Send it is in the past, so the server returns 22023 and the visitor sees the generic "Couldn't send". | Round the fallback up to the next 5 min after the actual now (or drop it). Show a "pick another time" message for 22023. |
| R-M12-13 | S3 | `ShareView.tsx:49-53, 87-90` | **The "Sent!" confirmation can be off-screen.**<br><br>After Send, the form closes and the confirmation shows at the top of `<main>`. At 390 px, for a day further down, it is off-screen, so the visitor may send again and use up the owner's rate limit. | Show the confirmation in place of the form, or scroll it into view. |
| R-M12-14 | S3 | `lib/share/compute.ts:39-46`, DECISIONS M12 | **Some planned time shows as free.**<br>- Sub-slots inside Free (e.g. a gym slot) show as free.<br>- Sick and Vacation days are shared like normal days.<br>Both are defensible, but they are product calls that weren't asked. | Ask Minnie, or subtract sub-slots of kind gym/task and show non-normal days as busy. |
| R-M12-15 | S3 | tests | **Coverage gaps:**<br>- No unit test for `compute.ts`: the `i = -1` path, a Free block after midnight, template fixed events.<br>- The leak test misses `sub_slots`, `first10_options`, `mode` and keys.<br>- The accept test checks only the `HH:MM` format, not where the event lands in the timeline.<br>- No test of switching chips.<br>- No E2E for Copy or Picture, TH, dark mode or the axe check on `/share`.<br><br>The integration `slot(h)` can pick a time after midnight, but the test doesn't check that `p_day` matches the wake-day (which R-M12-2 depends on). | Add these with the fixes above. |
| R-M12-16 | S4 | various | - Copy, link and picture failures show "Couldn't send. Try again."; this needs its own copy string.<br>- The inbox Accept/Decline buttons have no requester name in their accessible name.<br>- `fillText(maxWidth)` squashes long lines in the picture.<br>- The copied text has no timezone.<br>- The share page swallows compute errors as "No free time".<br>- The export contains the live share token (the same as the ICS token).<br>- A `share_link` race on first use (two tabs) can hand out a token that is immediately replaced.<br>- No events for copy or picture.<br>- An unknown link returns HTTP 200 (documented in DECISIONS). | Log only. |

## Verdict
**FAIL.** There is 1 S1 (R-M12-1, a privacy leak through `share_context`) and 4 S2s (R-M12-2 after-midnight slots / wrong-day accept, R-M12-3 a stale chip start, R-M12-4 no server free check plus a hard-coded `host: 'free'`, R-M12-5 copy/share after await on iOS). Fix them test-first, then re-review.

---

## Round 2 (re-review of the fixes)

- **Scope:** `git diff 7502eed..fdece3e` on `m12-local` at `fdece3e`, plus the DECISIONS entry "G7 M12 review" and `docs/M12-share-setup.md`.
- **Date:** 2026-11-13.

### What I ran
| Check | Result |
|---|---|
| `tsc --noEmit`, ESLint and Prettier on the changed files | clean |
| `i18n:check` / `secrets:check` | 1110 keys, EN = TH / OK |
| `npx vitest run tests/unit` | 58 files, 372/372 pass |
| `vitest` integration: `share` + `rls` | 93/93 pass |
| `pg_proc` grants (local DB) | `share_context` and `request_slot`: `service_role` only. `share_link_off` and `answer_booking`: `authenticated` only. |
| `next build` in a scratch copy of `fdece3e`, then grep for the service-role key **value** and for `SUPABASE_SERVICE_ROLE_KEY`, `service_role`, `share_context`, `request_slot` | 0 hits in `.next/static`, and the value isn't inlined in `.next/server` either (read at runtime). `admin.ts` and `server.ts` import `server-only`. `/share/[token]` builds as a partial prerender. |
| `next start` + HTTP probes of `/share/<token>` (owner with a sick day, a Free sub-slot labelled `SECRET_SUBSLOT`, an event `relatives_dinner` titled `SECRET_TITLE`) | The HTML/RSC contains none of: the sub-slot label, the event id/key/title, `sick`, `first10`, the user id. Only the display name, timezone and intervals. |
| The server action as a raw POST (`Next-Action` header) | The checks hold (details below). |

**Server action probe results:**
- A free 22:30 slot → `ok`.
- 04:00 (Sleep) and 14:00 (Work) → `notFree`.
- An unknown token, an object token, a `null` argument, or a non-string name → `invalid`.
- A numeric `start` → `notFree`.
- The 4th–6th rapid requests → `tooMany`: the per-owner limit still holds through the action.
- A cross-origin POST (`Origin: https://evil.example`) → 500, refused by Next's origin check.

E2E: not run here (WebKit isn't installed locally). I read the new CJ-SHARE-3 and the CJ-SHARE-1 additions.

### Status of round-1 findings
| ID | Status | Evidence |
|---|---|---|
| R-M12-1 (S1) | **Fixed** | `share_context` and `request_slot` are service-role only. Anon and authenticated get 42501 (integration test plus `pg_proc`). The page and the action get only name, timezone and intervals from `loadShare`. No key in the client bundle. The HTML probe shows no private fields. |
| R-M12-2 (S2) | **Fixed** (with the trade-off in R2-1) | Free is cut at `zonedInstant(date+1, 0)`. `request_slot` requires `p_day` = the start's local date (integration test). The unit test covers 07:00 to 13:00 wakes. An accepted booking keeps the wake (unit test). |
| R-M12-3 (S2) | **Fixed** | `key={open.start}`; E2E CJ-SHARE-3 asserts the stored start is 21:00. |
| R-M12-4 (S2) | **Fixed** | `askForSlot` recomputes free days and calls `slotFits` before the service-role RPC. My probe got `notFree` for Sleep and Work. The browser can't reach `request_slot`. See R2-2 for the remaining client-only part. |
| R-M12-5 (S2, iPhone) | **Fixed in code**; device or CI-WebKit confirmation still pending | The data and picture load on mount. `clipboard.writeText` and `navigator.share` are now called synchronously inside the tap; this is the pattern WebKit accepts. |
| R-M12-6 | Fixed | Control, zero-width, bidi and punctuation-only names are refused, and Thai is accepted (integration). `icsText` escapes a lone CR (unit). |
| R-M12-7 | Fixed | The server refuses accepting a past request (integration). Overlaps: the card offers Decline only once the slot is no longer free. |
| R-M12-8 / -9 / -10 / -12 / -13 | Fixed | All pending requests are listed. The timezone comes from the loaded context. `share_link_off` + "Stop sharing" (integration + E2E). The fallback start is ≥ now + 1 min. "Sent" shows in place. |
| R-M12-11 | Deferred (logged in DECISIONS) | OK as a known issue |
| R-M12-14 | Asked Minnie (logged) | Still true: my probe's sick day and its Free sub-slot both show as free. |
| R-M12-15 | Mostly addressed | Added: `share-compute.test.ts`, the chip E2E, the accept-placement unit test. Still missing: TH/dark/axe on `/share`. |
| R-M12-16 | Partly | Fixed: the copy error string, a11y names, the timezone in the copied text. The rest is logged. |

### New / remaining findings

| ID | Sev | Where | Failure scenario | Fix |
|---|---|---|---|---|
| R2-1 | S3 | `lib/share/freebusy.ts:46-49`, DECISIONS (G7 M12) | **Late risers lose most of their shareable free time.**<br><br>The R-M12-2 fix (correct for the engine) drops every minute of Free after local midnight. Probe with default blocks, 14 days from 08:00 Bangkok:<br>- wake 10:00 → 14 days with free time (2160 min)<br>- wake 11:30, 12:00 or 13:00 → only 6 days (1440 min)<br><br>The other days show nothing, because the whole Free block sits after 00:00. The DECISIONS entry records the cut but not this consequence. Minnie's 10:00 templates are fine. | Tell Minnie, and log it as a known issue for late chronotypes. The real fix is engine support for an after-midnight fixed event on wake-day D (e.g. `"24:30"` or a `+1` day flag in `FixedEventInput`); then the clip can move to the end of Free. |
| R2-2 | S3 | `components/settings/ShareCard.tsx:151-157` (`blocked`), `share.sql` `answer_booking` | **The "no longer free" guard is client-only and fails open.**<br>- `blocked()` checks free only when `days` is loaded. If `loadDayContext` fails (offline, timeout), `days` stays `null`, and a stale pending request offers **Accept**. That inserts `host: 'free'` at a time that may now be in Work and re-flows the day (the R-M12-4 effect).<br>- The server still accepts any non-past pending request.<br><br>Exposure is low: the owner only, and a stale request is needed. | Treat `days === null` as unknown and hide or disable Accept until the plan has loaded. Optionally pass the client's `slotFits` result, or the containing block, as `host`. |
| R2-3 | S4 | `components/share/ShareView.tsx:120-137` | When the remaining gap after `now + 1 min` (rounded up to 5) is under 30 min, `starts` and `lengths` are both empty. The selects are blank but Send stays enabled, and it gets "That time isn't free anymore". This happens only for a 30–35 min gap that starts now. | Disable Send (or show a "pick another time" hint) when `lengths` is empty. |
| R2-4 | S4 | `ShareCard.tsx` | - "Get my link" stays disabled forever if the pending-requests query errors (`pending === null`).<br>- The copied text and picture are computed at mount; if More stays open for hours, past slots are copied.<br>- `navigator.clipboard` missing (non-secure context) throws synchronously, outside `report`. | Log only. Optionally: re-derive `days` at tap time from the loaded ctx (it's synchronous), and guard `navigator.clipboard?.`. |
| R2-5 | S4 | `app/share/[token]/actions.ts` | **The action is a public endpoint.**<br>- Every POST with a valid token runs a service-role `share_context` plus the 14-day engine **before** the per-owner rate limit. That costs the same as a page view, with no per-IP throttle.<br>- `notFree` vs `invalid` tells a valid token from an invalid one, which is moot at 192 bits.<br>- Starts with seconds (e.g. `22:30:59`) are accepted and truncated to `HH:MM` on accept (harmless).<br><br>Input typing, the origin check and the free check all hold (probes above). | Log only. Optionally round start and end to the minute in the action and cap name/note length before `loadShare`. |
| R2-6 | S4 | `lib/supabase/admin.ts`, `docs/M12-share-setup.md` | If `SUPABASE_SERVICE_ROLE_KEY` isn't set on Vercel, every share link silently shows "not found", while More still hands out links. It is documented as a one-time setup step. | Make sure the env var is set before the PR is promoted, and add it to the `qc:prod` smoke (open a share link). |

### Verdict
**PASS.** There are no open S1/S2 findings: R-M12-1 to -5 are fixed and verified (R-M12-5 still needs a CI WebKit or device confirmation of the copy tap). New items are 2 × S3 (R2-1 late-riser free time, R2-2 client-only accept guard) and 4 × S4; log them as known issues or fix them if quick.
