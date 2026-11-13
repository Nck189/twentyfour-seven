# PERF PR #19 — G7 independent review (`getUserCached` + `dedupeGets`)

- **Scope:** `git diff origin/main..HEAD` on `perf-local` at `64c5491`.
- **Reviewer:** a fresh G7 subagent.
- **Date:** 2026-11-13.

## What I ran / read
- **Tests and checks:** unit 55 files, 358/358 pass. `tsc --noEmit` is clean. ESLint is clean on `lib/supabase`, `loadContext`, `events`, `tips`, `usePush` and the new test.
- **supabase-js 2.118 `fetchWithAuth`:** every request gets explicit `apikey` and `Authorization: Bearer <token>` headers, which then reach `dedupeGets` through `init.headers`.
- **postgrest-js:** passes `signal: undefined` unless `.abortSignal()` or a client `timeout` is set, so dedupe really applies.
- **auth-js:** uses the same custom fetch. `/auth/v1/user` is a GET carrying the user's bearer token; refreshes and sign-in are POST.
- **Call sites:** all 15 swaps are in client hooks or components. Auth flows: sign-out is `auth.signOut({ scope: "local" })` on the client, and sign-in is client `verifyOtp` or a full-page magic-link callback.

## Security / account mixing: no leak found
- **No key collision across accounts.** The dedupe key is `method + URL + every header sorted`, Authorization included. Two users, or the same user before and after a token refresh, never share a request. The map holds only in-flight entries, which are deleted when the response headers arrive, so nothing outlives a request and nothing survives sign-out.
- **The `getUserCached` reset works.** `onAuthStateChange` fires on SIGNED_OUT, SIGNED_IN, TOKEN_REFRESHED and USER_UPDATED, and auth-js broadcasts these across tabs.
  - Sign-out in More emits SIGNED_OUT.
  - The OTP sign-in emits SIGNED_IN.
  - The magic-link path is a full page load, so module state starts fresh.
  - A request already in flight for user A that resolves after the reset doesn't overwrite the new promise.
  - A null or failed answer is not cached.
- **Even a stale cached user can't read or write another account's data.** RLS uses the JWT, not the cached id. The worst case is a silent no-op: 0 rows updated, or an event insert refused (see P-3).

## Correctness: checked and OK
- **Writes never dedupe.** POST, PATCH and DELETE pass through. PostgREST GETs (including `rpc(..., { get: true })`, which runs read-only) and the auth `GET /user` have no side effects, and the app makes no client `functions.invoke` GETs.
- **HEAD count queries** (`useUnlocks`: `count: 'exact', head: true`) work:
  - The `Prefer` header is in the key.
  - `clone()` of a body-less response is fine.
  - `content-range` survives the clone.
- **Failures reach every waiter, and the next request starts fresh** (tested). So the offline quiet retry (`QUIET_RETRY_MS`) and the "Try again" path still make a new request, and failed-save queues use POST/PATCH, which are untouched.
- **Clone and memory:**
  - Only clones are read. The original is never disturbed, so `clone()` never throws "body used".
  - The unread tee branch buffers the body until the original `Response` is unreachable, which happens once the callers return. That is a transient ~2× of each deduped body; fine for PostgREST JSON (see P-5 for large exports).

## Findings

| ID | Sev | Where | Scenario | Fix |
|---|---|---|---|---|
| P-1 | S3 | `lib/supabase/fetchWithTimeout.ts:84-104` | **Read-after-write can return pre-write data.**<br><br>A GET that starts *after* a write (an RPC, update or upsert) joins an identical GET that started *before* the write and is still in flight, so it returns the pre-write snapshot. Without dedupe, the later GET would see the write.<br><br>Example: a hook re-reads after `claim_setup_rewards`, a gacha pull or a realtime event while another hook's identical select from mount time is still loading. The UI then shows stale coins, tickets or rows until the next refresh. The server stays authoritative (gacha and coins are RPC-checked), so nothing is lost or double-spent. | When any non-GET/HEAD request passes through the wrapper, clear `inflight` (bump a generation counter in the key), so later GETs never join pre-write ones. Add a unit test: GET₁ in flight → POST → GET₂ makes a second request. |
| P-2 | S3 | `tests/unit/dedupe-gets.test.ts` | Test gaps:<br>- Nothing covers `getUserCached`: shared promise, reset on an auth event, null/error not cached, a stale in-flight promise not restoring the old user.<br>- None of: `Request` input passing through, HEAD + `Prefer` key, more than 2 joiners each reading the body, the abort-sharing semantics (P-4), read-after-write (P-1). | Add these. `getUserCached` needs a small seam (inject the client, or export a reset for tests). |
| P-3 | S3 | `lib/supabase/client.ts:33-52` | **The cached user is trusted until an auth event.** If a session changes without an event reaching this page, the cache stays on the old user. This can happen if the cookie session is replaced by another tab or window and the broadcast is missed (e.g. BroadcastChannel unavailable, or the PWA window suspended), or on an expiry handled server-side.<br><br>Callers then keep filtering by the old user's id under the new JWT: settings saves update 0 rows, `logEvent` inserts are refused, and Today loads an empty context. RLS makes this safe but silent. Before, every call re-verified. | On each call, compare the cached `user.id` with the local `getSession()` user id (no network). If they differ, drop the cache and re-verify. |
| P-4 | S4 | `fetchWithTimeout.ts:94-103` | **A joiner inherits the first caller's 15 s timer.** A caller that joins at 14.9 s fails with TimeoutError 0.1 s later instead of getting its own 15 s. Its quiet retry then makes a fresh request, so this is a degraded deadline, not a failure path. | Document it. Optionally join only requests that started within a short window (e.g. ≤ 2 s). |
| P-5 | S4 | `fetchWithTimeout.ts:103` | A deduped large GET (Export's full-table reads) is buffered twice in memory until the callers finish. | Optionally bypass dedupe for very large reads, e.g. pass a `signal` from Export. |
| P-6 | S4 | `lib/today/loadContext.ts:15` | `loadDayContext(client, …)` now ignores its `client` for auth and uses the browser singleton. All callers pass `getSupabase()` today, but a future caller with another client (server or test) would get the wrong user. | Take the user from the passed client, or drop the parameter. |
| P-7 | S4 | `client.ts:35-40` | `INITIAL_SESSION` (and hourly `TOKEN_REFRESHED`) clears the cache right after the first call. This explains "~2" auth calls per page instead of 1; perf only. | Optionally ignore `INITIAL_SESSION` and `TOKEN_REFRESHED` when the user id is unchanged. |

## Verdict
**PASS.** There are no S1/S2 findings, and nothing mixes or leaks data between accounts. P-1 and P-3 are worth fixing before merge (both are small). Otherwise, log P-1 to P-3 as Known issues (S3); P-4 to P-7 are S4.

## Fixes before merge (2026-11-13)
| ID | Status |
|---|---|
| P-1 (S3) | Fixed: any write passing through the wrapper clears the in-flight reads, so a read after a write never joins one from before it (unit test). |
| P-2 (S3) | Added: `getUserCached` unit tests (shared call, auth event resets, signed out not cached, failures not cached, another account in the local session); `dedupeGets` tests for 5 callers, HEAD counts, `Request` inputs, write-then-read. |
| P-3 (S3) | Fixed: each call compares the cached user with the local session (no network); another account drops the cache, no session returns no user. |
| P-4 … P-7 (S4) | Accepted: a late joiner shares the first caller's timeout (its quiet retry starts fresh); export bodies held twice briefly; `loadDayContext` uses the shared client for the user; ~2 user calls per page. |
