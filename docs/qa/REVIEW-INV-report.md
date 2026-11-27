# QC report: Invites for the pilot (Phase E part 1, 2026-11-24)

| Gate | Result | Evidence |
|---|---|---|
| G1 Static | ✅ | `qc:static`: typecheck, lint, Prettier, i18n (1380 keys EN/TH), art lint |
| G2 Functional | ✅ | Vitest 119 files / 783 tests. Integration covers: room for 2; a race for the last place; refusals (own link, old account with access, turned-off link, made-up token); unlimited links; the switch; pay rules (backfilled, missed and lived days, once each, a second friend on the same date); writes blocked; a deleted friend not freeing a place; a gated account joining at any age; a gated account refused a link. Local E2E Chromium: 167 passed, 1 skipped (new: join through a link plus the reward; the gate plus pasting a link) |
| G3 Visual | ✅ / ⏳ | Reviewer swept the invite page, gate, card and admin controls at 390 and 320 px, EN and TH, light and dark. The one overflow (a long name) is fixed. No visual baselines yet for the new screens |
| G4 UX | ✅ | axe 0 serious; touch targets ≥ 44 px; every state (loading, error with retry, full, closed, own link) has its own words |
| G5 Data & security | ✅ | RLS `user_id = auth.uid()` on `invites` and `invite_links`; `app_config` unreadable by users; the anonymous preview needs a valid token and returns only a capped name and whether the link has room; rewards are decided in the DB; admin actions check the admin's email server-side |
| G6 Production | ⏳ | **Before merge:** Minnie runs `db push` (`20261125000000_invites.sql`). After: `qc:prod`. Invite-only stays off until she turns it on at `/admin/retention` |
| G7 Independent review | ✅ after fixes | `docs/qa/REVIEW-INV-review.md`: FAIL on 2 × S2, both fixed test-first |

## Findings
- **F1 (S2), fixed test-first.** Deleting a friend's account freed their place. Room is now a `used` counter that never goes down.
- **F2 (S2), fixed test-first.** An old gated account could never join. Now only accounts that already have access must be new, and the gate gives the real reason (full, closed, own link).
- **F4 (S3), partly fixed.** A gated account can no longer make an invite link (test-first). Rewards don't wait for the gate; accepted, because a gated account can only touch its own data.
- **F5 (S3), fixed.** A failed access check isn't remembered.
- **F6 (S3), partly fixed.** Names are capped at 30 characters and wrap, and the privacy line is added. There's no name field yet (deferred).
- **F8 (S3), fixed.** The admin text says "first turned on", and the switch writes an event.
- **F10 (S4), partly fixed.** A network error on the invite page says so, with Try again. Som only looks happy on an open invite.
- **F3, F7 (S3), accepted for the pilot.** Reasons are in DECISIONS.
- **F9 (S3), deferred.** Listed in DECISIONS.

Side effect from the review: the local test account `admin-e2e-mac@test.local` has an unlimited invite link. It's local only and harmless.
