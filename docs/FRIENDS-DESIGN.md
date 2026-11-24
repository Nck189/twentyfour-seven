# Friends: design (Phase E, docs/REVIEW_FIX_PLAN.md)

**Status (2026-11-24):** Minnie approved the invite part with changes (below), and it is built (migration `20261125000000_invites.sql`). The wake buddy (§2) waits for the pilot.

**Minnie's decisions (2026-11-24):**
- **Invite-only during the pilot, with a switch.** Without an invite link, a new account can't use the app. Minnie turns it on or off on `/admin/retention`, and accounts made before it was turned on keep their access.
- **Two invites per person.** Minnie's own link has no limit (a button on the admin page).
- **Reward:** 1 capsule ticket each, when the friend finishes their first lived minimum day.

The caps of 5 a week and 20 in total in §1 are replaced by the per-person limit of 2. The original text below is kept for the record. The plan says to build only after the pilot (10–20 friends) shows that people stay, so read `/admin/retention` first (§6).

**Why:** the review's biggest gap is that nothing in 24/7 is done with or for another person. Sharing free time (M12) is the only link to someone else, and it doesn't need the other person to have an account. SPEC §11 still rules out a social feed, friends' farms and leaderboards. This design keeps to that: two small, private ways to involve one friend, and nothing public.

---

## 1. Invite link (G5)

**What the person sees**
- More → Sharing → **Invite a friend**: one personal link, with Copy and Share (LINE/IG). The share picture is the existing farm picture with the QR code pointing at the invite link.
- The friend opens the link and sees the front door (Phase B), with one line on top: "Minnie invited you". Signing up goes through the normal 6-digit code. The invite is remembered across the sign-up (localStorage plus a server check).
- When the friend finishes their **first minimum day** (`day_results.kind in ('minimum', 'perfect')`):
  - both people get **1 capsule ticket**, once;
  - the inviter sees a quiet line on Today the next morning: "Your friend finished their first day. +1 ticket".

**Rules (server-side, in a `security definer` RPC like every other ticket)**
- One link per account (`invite_links`, token like `share_links`: 48 hex). The link can be turned off or made new; a new one stops the old one.
- A friend can be credited to only one inviter, set at sign-up and never changed.
- Paid at most **5 times per inviter per week** and **20 in total**. That's enough for a real pilot and makes farming it worthless.
- No pay for:
  - inviting yourself: the same email domain plus the same device id within 24 h is refused;
  - an account deleted before its first day;
  - a day that was backfilled. The first day must be lived: at least one live check-in, the same rule as the other tickets (R1).
- New `ticket_grants` reasons: `invite_sent` (inviter) and `invite_joined` (friend). `ref_date` is the friend's first day, and the key `(user_id, reason, ref_date)` keeps each payment to once.

**Events:** `invite_link_created`, `invite_opened` (anonymous, counted only), `invite_signed_up`, `invite_paid`.

## 2. Wake buddy (G7)

**What the person sees**
- More → Sharing → **Wake buddy** → "Pair with a friend": a one-time pairing link, valid 24 h. The friend taps it while signed in and confirms "Pair with Minnie?".
- After pairing, Today's header shows a tiny second dot next to Som:
  - "Ploy is up" once the buddy pressed I'm up in their wake window today (`wake_events.in_window`);
  - "Not yet" before that;
  - nothing on the buddy's away/vacation days.
- **A shared wake streak:** the days you were both up in your own windows, counted in each person's own timezone. A small number on the Wake buddy card, with a soft Som moment at 7 and 30 days. No tickets, so pairing can't be used to farm.
- That's all one can see of the other. No blocks, plan, farm, coins, sleep times, wake times or miss reasons.
- **Unpair** is one tap for either person, no confirmation needed. The other side just sees the card go back to "Pair with a friend": no notification and no "unfriended" message.

**Rules**
- One buddy at a time (pilot). A pair is `wake_buddies(a, b, since)` with `a < b`, and each user is in at most one row.
- Reading the buddy's status goes through one RPC, `buddy_today()`. It returns `{ name, up: boolean | null, streak }` and checks that `auth.uid()` is in an active pair. RLS stays `user_id = auth.uid()` on every table: no policy ever lets one user read another's rows directly.
- `name` is the buddy's `display_name` (first name or nickname, editable in Account), never their email.
- Push (M11): "Ploy is up" is **off by default**, with its own switch. Never sent during quiet blocks.

**Events:** `buddy_link_created`, `buddy_paired`, `buddy_unpaired` (which side, no reason).

## 3. Privacy, blocking, deletion

**Privacy text** (More → Sharing; EN + TH drafts to be written with the build):
- Invite: "Your friend sees your first name on their sign-up page. When they finish their first day, you both get a capsule ticket. We don't tell you anything else about their account."
- Wake buddy: "Your buddy sees only whether you pressed I'm up in time today, and your shared streak. Never your plan, sleep, farm or anything else. Either of you can unpair at any time."

**Blocking:** unpairing ends everything, and the pairing link is single-use. A blocked person can't pair again with a new link for 30 days (the pair key is kept for 30 days after unpairing).

**Deleting an account** (G15, `delete_account`):
- removes their invite link, their pairs (the buddy's card resets) and their invite credit rows;
- leaves the other person's tickets alone, because tickets already paid stay paid;
- the inviter's "your friend finished" line never names a deleted account.

**Export** (CJ-17): the user's own invite link, inviter (name only), invited count, and buddy pairing dates. Never the buddy's data.

## 4. What the retention dashboard should count (`/admin/retention`, Minnie only)
- **Invites:** links made, opened, sign-ups, paid; the share of sign-ups that came from an invite.
- **Cohorts split by invited vs not invited:** day 1/7/14/30 retention, using the same definition of "active" as today.
- **Wake buddies:** pairs made, pairs still active after 7 and 30 days, and day 7/30 retention of paired vs unpaired users.
- Counts only, never names. Under 5 in a group shows "—" so no one can be singled out.

## 5. Data model (one migration when built)
- `invite_links(user_id pk, token unique, created_at, active)`
- `invites(invitee_id pk, inviter_id, opened_at, signed_up_at, paid_at)`: inviter is set once at sign-up; RLS lets the invitee read their own row; the inviter reads counts through an RPC.
- `wake_buddy_links(token pk, user_id, expires_at, used_at)`
- `wake_buddies(a, b, since, ended_at, ended_by)`, with `a < b` and a partial unique index on active pairs per user.
- RPCs, all `security definer` with `search_path = ''` and an `auth.uid()` check:
  - `create_invite_link`, `claim_invite` (at sign-up), `invite_status`;
  - `create_buddy_link`, `pair_buddy`, `unpair_buddy`, `buddy_today`.
  - The payment for the friend's first day runs in `settle_days`, the same place the streak and day tickets are paid.
- Tests: integration (each refusal, the weekly and total caps, unpair, deletion), unit (shared streak across timezones), E2E (two browser contexts: invite → sign up → first day → both paid; pair → I'm up → the buddy sees it → unpair).

## 6. When to build: the pilot gate
Build after the pilot only if `/admin/retention` shows people staying, roughly **day-7 retention ≥ 30 %** with at least 10 sign-ups. If people don't stay, friends won't fix that: fix the first week instead.

The invite (§1) is small and helps the pilot itself, so it can come first. The wake buddy (§2) needs people who already use the app every morning.

## Decisions for Minnie
| # | Decision | Default here |
|---|---|---|
| E1 | Build the invite link now (before the pilot ends), or wait for the retention numbers | Invite now, wake buddy after the pilot |
| E2 | Invite reward | 1 capsule ticket each, once, when the friend finishes their first minimum day |
| E3 | Invite caps | 5 a week, 20 in total |
| E4 | Wake buddy: how many buddies | One at a time |
| E5 | "Your buddy is up" push | Off by default, with its own switch |
