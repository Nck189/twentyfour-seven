# G7 independent review: Invites for the pilot (commit e28bf33, branch `phase-e-design`)

**Reviewer:** independent G7 subagent (no implementation context) · **Date:** 2026-11-24
**Scope:** `supabase/migrations/20261125000000_invites.sql`, `components/invite/*`, `app/i/[token]`, `app/admin/retention/{actions.ts,InviteAdmin.tsx,page.tsx}`, `lib/invite/token.ts`, `lib/export/tables.ts`, `lib/supabase/proxy-session.ts`, `lib/stats/retentionServer.ts`, i18n, tests. Checked against `docs/FRIENDS-DESIGN.md`, the last `docs/DECISIONS.md` entry, `CLAUDE.md` and `docs/QA_QC.md`.

**Environment note:** partway through the review, the local Supabase (Docker) and the server on :3100 were down (the container had restarted). I did not restart them. Once the coordinator said they were back, every live check below was run against them. The `invite_only` switch is back to its original value, `{"on": false, "since": null}`.

## Verdict: **FAIL**

There are two S2 findings. F1: the "2 friends per link" cap can be refilled by deleting friends, so the inviter is paid without limit. F2: an uninvited account older than 3 days is locked out for good, with no way out from the gate. Neither breaks the core security model. Grants, RLS, the token-checked anonymous preview, server-side payment and the admin checks all held up when probed (details below).

---

## Findings

### F1 · S2 · Deleting a friend's account frees their slot, so one link pays the inviter without limit
**Evidence (live probe, `review-inv/probe.test.ts` P1):** a host's link is used by friends A and B, and both have a paid day, so the host has +2 tickets. A calls `delete_my_account`. A new account C then claims the **same** link and gets `OK`, C's lived day pays the host again (host delta **3**), and `invite_status` still shows `quota 2` with 2 joined.
**Why:** both `claim_invite` and `invite_preview` count room as `count(*) from invites where inviter_id = …`, and the friend's `invites` row cascades away with their account. Minnie's decision of 2 per person (which replaced the 5/week and 20 total caps) is therefore not a cap. A user with throwaway emails can earn one extra ticket per throwaway per lived day, about 2 a day in parallel. This counts as "wrong rewards" in the QA_QC S1 row. I rate it S2 only because it takes deliberate abuse plus a real in-window wake and Night ritual on each throwaway.
**Fix (test-first):** keep the count on the inviter's side so it survives deletion. Options: a `used` counter on `invite_links`, incremented in `claim_invite` under the existing row lock; or keep a tombstone (`invites.user_id` → `on delete set null` plus a separate surrogate PK); or count `invite_sent` payouts from an inviter-side ledger. Add an integration test: claim → pay → delete friend → a new claim is refused with `invite full` and the host is not paid a 3rd time.

### F2 · S2 · An uninvited account older than 3 days can never get in, and the gate offers no way out
**Evidence (P2):** with the switch on and `since` set 10 days ago, an account created 4 days ago returns `my_access → {allowed:false}`. Its `claim_invite` with a valid open link is refused with `not a new account` (P0001), and `my_access` stays `allowed:false`. The gate then shows "That invite can't be used: it's full, turned off, or yours." (seen at 390 EN and 320 TH), which is not the reason. The gate's only control is Sign out. Delete account is in More, behind the gate, and the same email always signs back into the same account. The person is stuck until someone edits the DB.
This is easy to hit. Someone signs up before a friend has sent them a link and gets the link 4 days later. Or Minnie turns the switch off for a few days and back on: `since` keeps its first stamp, so everyone who joined while it was off is gated (see F8) and, after 3 days, can never claim.
**Fix:** the 3-day rule exists to stop an existing account from taking a friend's place. Apply it only to accounts that already have access. In `claim_invite`, allow the claim when `my_access()` says not allowed, whatever the account's age. Also give the gate a specific message per refusal (use distinct error codes or a `reason` in the result), and either a delete-account link or a "contact Minnie" line. Add integration tests for "gated + old → claim succeeds" and "allowed + old → refused".

### F3 · S3 · The design's self-invite guard isn't built, and the deviation isn't logged
FRIENDS-DESIGN §1 says inviting yourself is refused (same email domain plus same device within 24 h). The build refuses only your *own* link. A second account of yours claims your link and both are paid (2 tickets per real person, unlimited with F1). That's acceptable for a 10–20 friend pilot, but DECISIONS doesn't say the guard was dropped. **Fix:** log it in DECISIONS as a deliberate pilot trade-off, or add a cheap guard (e.g. refuse when the inviter and invitee emails share a non-public domain and were created < 24 h apart). Fixing F1 bounds the damage either way.

### F4 · S3 · The gate is client-only; gated accounts can mint links and let each other in
**Evidence (P3, switch on):** two fresh uninvited accounts X and Y (`allowed:false`) call `create_invite_link` over REST, which succeeds. Y claims X's link, X claims Y's link, and both are now `allowed:true`. Gated accounts can also call every game RPC: `settle_days` and `press_wake` succeed, and on a gated user's page load the network log shows `claim_unlocks`, `claim_setup_rewards` and `settle_days` firing *before* `my_access`.
DECISIONS says "no reward depends on it", which is true, so this is not a security hole. But it means invite-only only filters people who don't open devtools. **Fix (cheap):** have `create_invite_link` and `claim_invite` refuse when the *inviter's* `my_access` is not allowed, so a gated account can't vouch for anyone. Optionally have `claim_setup_rewards` and `settle_days` return early for gated accounts.

### F5 · S3 · A failed access check is remembered as "allowed" for good
**Evidence (`review-inv/ux2.spec.ts`):** with `my_access` stubbed to HTTP 500 once, `localStorage["247-access-ok"]` is set to the user's id. After a reload where the server says `allowed:false`, the gate does **not** appear (count 0). `InviteGate.check()` returns `"allowed"` on error, and the effect caches every `"allowed"` result. One flaky network moment, or an offline PWA start, unlocks that browser permanently. **Fix:** cache only when the server returned `allowed: true`, and fail open without caching on an error.

### F6 · S3 · Names never appear: no UI sets `display_name`, and it has no length cap
`grep` finds no component or lib code that writes `profiles.display_name`; only the E2E sets it through the service role. In practice the invite page always says "A friend invited you to 24/7", which loses the design's "Minnie invited you". The inviter's joined list shows "A friend · …" for every friend, so they can't tell who finished. If a user sets a name through REST, there is no length limit. A long unbroken name overflows the invite page: scroll width is **483 px at 390** and **448 px at 320**, in EN and TH and in light and dark (`landing-open-*` shots). The §3 privacy line ("Your friend sees your first name on their sign-up page") is also missing from the card. **Fix:** either add a first-name field (Account or onboarding) with a DB check such as `char_length(display_name) <= 30`, `break-words` on the heading, and the privacy line, or drop names from the design and the invite page.

### F7 · S3 · An already-allowed account under 3 days old that opens any invite link becomes that person's invitee without being told
**Evidence (`ux.spec.ts`):** an account about 1 day old with full access (it joined while the switch was off) opens a third person's open link and taps "Get started". It lands on Today, and an `invites` row now exists for it, taking one of the inviter's 2 places and later paying them. The page never says the visitor already has an account. DECISIONS says "an existing account can't take a friend's place". That holds only after 3 days. **Fix:** when the visitor is signed in, show "You're already in 24/7" on `/i/<token>` and don't save the token. Combined with F2's fix, only claim when access is actually missing.

### F8 · S3 · Off→on switch semantics: the admin copy is wrong, and devices disagree
`setInviteOnly` keeps the first `since` stamp. After on → off (a week) → on, accounts made during the off week are gated (then stuck after 3 days, F2). The admin text says "Accounts made before you turned it on keep their access", which Minnie will read as covering them. Their already-used browsers keep `247-access-ok`, though, so the same account is in on its phone and gated on a new device. Admin switch changes also write no `events` row (live check: no invite-related events for the admin). **Fix:** stamp `since` on every off→on, or change the copy to "…before <date>" and show the date. Write an `events` row (or an `app_config` history) for each switch change.

### F9 · S3 · Design §1 items missing and not listed as deferred
- No **Share** button (Web Share for LINE/IG) and no QR farm picture; only Copy exists.
- No way to **turn the link off** (`active` exists but nothing sets it false, and `create_invite_link` forces `active = true`).
- Events: `invite_opened` (anonymous count) is not written, and `invite_signed_up` is named `invite_claimed`. The §4 dashboard needs "opened".
- Export: §3 says "inviter (name only), invited count". The export dumps the raw `invites` row, which includes the inviter's internal `inviter_id` UUID, and has no invited count.
- The friend gets no feedback when paid: `settle_days`' `granted` list doesn't include the trigger's grant, so nothing tells them about the +1. DECISIONS defers only the *inviter's* Today line.

**Fix:** build them, or list them under "Not built yet" in DECISIONS.

### F10 · S4 · Nits
- The invite page shows "This invite is used up" when `invite_preview` fails on the network. Show a retry instead.
- The used-up page uses Som's *happy* pose (`preview === null ? "sit" : "happy"` only catches null, not `{open:false}`).
- "New link" kills the old link instantly with no confirmation; friends holding the old link see "used up".
- `invite_only()` is granted to `anon` and returns `since`, which tells anyone when invite-only was switched on. Harmless, but `my_access` already covers the client's needs.
- `tokenFrom` also accepts a `/share/<48hex>` link and then reports "can't be used" instead of "not an invite link".
- `_pay_invite`'s "lived" test (any non-backfilled `block_logs` row) is looser than R1's "live check-in". It's harmless only because `settle_days` already needs an in-window live wake for minimum or perfect. Add a comment, or reuse `_start_counts`.
- Concurrent double claims by one user surface as a 23505, which the gate treats as "network" and retries. That works, but returning `already` would be cleaner.

---

## Conformance (DECISIONS 2026-11-24 and FRIENDS-DESIGN)
| Decision | Result | Evidence |
|---|---|---|
| Invite-only switch on `/admin/retention`, admin only | **PASS** | Live: the admin toggles on, then off, and `app_config` updates with `since`. Server actions check `isAdminEmail` from `auth.getUser()` before acting. Non-admins get a 404 on the page (admin E2E passes). `app_config` returns `permission denied` to users and anon. |
| 2 invites per person, unlimited for Minnie | **FAIL** (F1) | The quota is enforced at claim time, including under a race (integration test plus live P5: rotating the link keeps the count). Deleting friends refills it (P1). Unlimited works: live result `quota:null`. |
| 1 ticket each on the friend's first lived minimum day, once | **PASS** (per friend), but see F1 | Integration: a backfilled-only day or a missed day doesn't pay; a minimum day pays once; a later perfect day doesn't. Two friends on the same date both pay the host. `settle_days` needs a live in-window wake for minimum, so a backfilled day can't pay. |
| Who gets in: invited, or made before `since` | **PASS** server-side; F2/F4/F5/F8 | `my_access` is correct in the integration test and probes. |
| Check runs once per account per browser; fails open | **PASS** as written, but the fail-open result is cached (F5) | Live check. |
| Claim: token kept in the browser, new account claims after sign-in; under 3 days only; row lock | **PASS** with F2 and F7 | E2E join flow passes. Race test: exactly one of two claims wins. |
| Paying by trigger: ledger for the friend, direct for the inviter | **PASS** | `ticket_granted` event with `invite_sent` for the inviter; `ticket_grants` row with `invite_joined` for the friend. |
| `app_config` global, not exported, unreadable | **PASS** | RLS forced, no policies, all privileges revoked (psql), `GLOBAL_TABLES`. |
| Design §1 Share/QR, turn-off, self-invite guard, events, export shape | **FAIL**, not logged (F3, F9) | See above. |
| Design §3 deletion: removes link and credit; paid tickets stay | **PASS** | P1: after the friend is deleted, no `invites` row is left. After the host is deleted, the friend's row keeps `inviter_id: null` and `paid_on`, and access stays. `delete-account.test.ts` passes, and it covers the new export tables. |

## Security checks (all live unless noted)
- **Table grants (psql):** `invite_links` and `invites` give SELECT only to `authenticated`, and anon has nothing. `app_config` gives nothing to anon or authenticated. RLS is enabled and forced on all three. Policies are `user_id = (select auth.uid())`, for select only.
- **Client writes:** a user's own `invite_links` update or delete, and `invites` update or insert, return `permission denied`; an `app_config` upsert returns `permission denied`. Another user reads `[]` from both tables.
- **Function ACLs (psql):** every new function is `security definer` with `search_path=""`. `invite_preview` and `invite_only` are executable by anon (intended). `create_invite_link`, `invite_status`, `claim_invite` and `my_access` are authenticated only; anon calls return `permission denied`. `_pay_invite` is not executable by anon or authenticated.
- **Anonymous `invite_preview`:** returns only `{name, open}` for a valid 48-hex token (name is always null today, F6). Junk or SQL-ish input returns null. The 192-bit token can't be enumerated.
- **Claim abuse:** your own link is refused. A second claim returns `already`. A rotated old token is refused (`no such invite`). Two users racing for the last place leave exactly one winner. One user claiming two links at once ends with a single `invites` row. Old accounts are refused (F2 covers the downside).
- **Admin actions:** `setInviteOnly` and `makeMyInvitesUnlimited` both return false before any DB access when `isAdminEmail` fails (static check; server actions can be POSTed by anyone, so the in-function check is what matters, and it is there). `loadInviteAdmin` is also admin-gated.

## UX checks (390 and 320 px; EN and TH; light and dark; production build on :3100)
- **Invite page:** the open, full/used-up, unknown and junk-token states all render, with no horizontal overflow except a long name (F6). axe shows 0 serious or critical issues and all targets are ≥ 44 px. Signed in, a full link shows the used-up page without harm. Signed in on an open link, see F7.
- **Gate:** bad link → "That doesn't look like an invite link." Full link → generic "can't be used" (wrong reason for old accounts, F2). Good link → enters the app (existing E2E). Sign out → `/login`. TH copy reads naturally. axe 0 serious; no overflow at 320.
- **Invite card:** loading, no link ("Get my invite link"), link with "2 invites left" / "ชวนได้อีก 2 คน", 0 left with Copy disabled, joined list (paid and waiting), and Copy feedback in TH all checked. No overflow at 320; axe 0 serious.
- **Admin controls:** EN light 390 and TH dark 320 both render; buttons are 44 px tall; the state text and the Saved/failed status work.

## Commands and checks run
- `npx tsc --noEmit` (0 errors), `npx tsx scripts/i18n-check.ts` ("1375 keys in en/th"), eslint `--max-warnings 0` on the changed dirs (clean), prettier `--check` (clean).
- `npx vitest run tests/unit/invite-token.test.ts tests/unit/export-tables.test.ts tests/unit/public-paths.test.ts`: 4/4 passed.
- `npx vitest run tests/integration/invites.test.ts tests/integration/delete-account.test.ts` (plus probes): 12/12 passed.
- Playwright `tests/e2e/invites.spec.ts` and `tests/e2e/admin.spec.ts` on chrome-desktop: 3/3 passed.
- Temporary probe specs (P1–P5 integration; UX sweeps 1 and 2), copied into `tests/` only while they ran and deleted afterwards. Sources and screenshots are in `/tmp/claude-0/-home-user-twentyfour-seven/70c331e7-c8a5-54e2-a6b6-8031bbfe6cac/scratchpad/review-inv/` (`probe.test.ts`, `ux.spec.ts`, `ux2.spec.ts`, `notes.log`, `notes2.log`, `shots/`).
- psql: `pg_proc` ACLs and `proconfig`, `information_schema.role_table_grants`, `pg_class` RLS flags, `pg_policies`.
- Side effects: the switch was toggled on and off once through the admin UI and then reset to the original `{"on": false, "since": null}`. The test account `admin-e2e-mac@test.local` now has an unlimited invite link. Test users were created with the usual `rv-*` and `rvux*` prefixes.
