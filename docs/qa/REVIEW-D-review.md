# Review fix Phase D — G7 independent review

- **Scope:** `git show 5695f0e` ("Phase D: More in four groups"), against `docs/REVIEW_FIX_PLAN.md` § Phase D and CLAUDE.md.
- **Reviewer:** a fresh G7 subagent with no implementation context. Read-only.
- **Date:** 2026-11-20.

## Verdict: PASS

There are no S1 or S2 findings. There are 4 S3 and 5 S4 findings. D-1 and D-2 are small and should be fixed before merge.

## What I ran
| Check | Result |
|---|---|
| `tsc --noEmit -p .` | clean |
| ESLint on the changed code and test files | clean |
| `npx vitest run tests/unit/more-groups.test.ts` | 4/4 pass |
| `npm run i18n:check` | 1294 keys, EN = TH |
| E2E | **Not run** (as instructed). UI findings come from reading the code. |

## Verified OK
- **Cards:** every card from the old page is on exactly one sub-page. There are 15: setup-links, exercise / language, theme, sound, notifications, tips, café / share, calendar / install, privacy, export, account. Delete account is inside the account card.
- **Setup card:** `SetupCard` (`#setup`) stays on `/more`. Today's compact link `/more#setup` still lands on it, because `hashRedirect` returns null for it.
- **Moved verbatim:** the locale sync (`changeLocale`), sign out (hard navigation) and `DeleteAccount`.
- **Tab bar:** the tab is active on `/more/*` (`AppShell.tsx:19` uses `startsWith`). `SidePanel` keys on `/farm` only, so iPad is unchanged.
- **No other links into More:** none in `public/sw.js`, the push payload (`push-send/deliver.ts:34` sends `/today`), edge functions or migrations. All four `/more#` entries in `SETUP_HREF` are updated.
- **No open redirect:** `hashRedirect` can only return `/more/<group>#<id>` with an `id` from the whitelist.
- **Page structure:** each page has one h1. Rows are `min-h-16`, and the back link is `min-h-11`. The back link's accessible name ("Back to More" / "กลับไปหน้าเพิ่มเติม") contains its visible label.
- **Specs not weakened:**
  - `states` now has two loads with the same assertions.
  - The `data` and `shell` specs wait on the new h1.
  - CJ-14 adds a check on `/more`.
  - `onboarding` now expects `/more/setup`.
  - `share`, `ics`, `push`, `cafe`, `tips` and `story` only change the URL.

## Findings

### D-1 (S3) Setup reward notices are swallowed on the sub-pages
- **Where:** `app/(app)/more/MoreScreen.tsx:135` and `:167-174` (Setup shows only `exercise`), `:183` and `:208` (Preferences shows only `language`), `:77` (`/more` hides `exercise`). Also `components/onboarding/Onboarding.tsx:51`.
- **What happens:** `useSetupRewards()` **claims** on every mount. Each sub-page then shows only its own step.
  - The main case: tap "Set your sleep times" or "First 10 minutes" on `/more`'s Set up 24/7 card, or in More → Setup. Finish or Close, and Onboarding now returns to `/more/setup`. That page's claim pays `sleep_times` (2 seeds + 1 ticket) or `first10` (1 ticket), and the notice is filtered out. The user also lands on a page without the progress card they started from.
  - The old page returned to `/more` and showed "Setup reward …" (the R-M7-5 fix).
  - The same happens to any grant claimed on `/more/preferences` other than language, for example notifications after a reload.
  - It also happens to an `exercise` grant claimed on `/more` (the filter assumed the exercise card was on the same page).
- **Impact:** the rewards are still paid, only the feedback is gone. The original R-M7-5 "paid silently" was rated S3, so this is S3, but it is a regression against "unchanged inside".
- **Fix:**
  - `/more` shows every grant.
  - `/more/setup` shows every grant except exercise at the top, and exercise inline.
  - `/more/preferences` shows every grant.
  - Optionally, send Onboarding back to `/more` when it was opened from the Set up 24/7 card.
  - Test first, E2E: new account → More → Setup → "Your week" → Done → expect "Setup reward" to be visible.

### D-2 (S3) `hashRedirect` throws on a malformed hash and crashes More
- **Where:** `lib/more/groups.ts:30` (`decodeURIComponent`), called from the effect at `MoreScreen.tsx:70-73`.
- **What happens:** `/more#%` or `/more#%E0%A4` (a truncated link) throws a `URIError` inside `useEffect`. The root `app/error.tsx` then replaces the More screen.
- **Fix:** wrap the decode in try/catch and return null. Add the unit test `hashRedirect("#%") === null`.
- **Related, no change needed today:** the redirect runs on mount only. A same-page hash change on `/more` (a Link to `/more#x` while already on `/more`) would not redirect. No such link exists now.

### D-3 (S3) The G4 and CJ-14 sweeps no longer cover the cards
- **Where:** `tests/e2e/shell.spec.ts:9` (`SCREENS` includes `more`), `:65-72` (G4) and `:86-92` (raw-key check).
- **What happens:** `/more` used to hold all 15 cards. Those loops checked a11y, touch targets, horizontal scroll and raw i18n keys on them in EN and TH, light and dark. Now `/more` is just four rows. The cards are checked only in `more.spec.ts`, in EN light, with no raw-key check.
- **Impact:** Thai overflow and dark-mode contrast of the cards are no longer gated.
- **Fix:** add `more/setup`, `more/sharing`, `more/preferences` and `more/account` to the G4 loop and the CJ-14 loop. The tab-navigation test can keep the five tabs.

### D-4 (S3) In-app "where to find it" strings are stale or wrong
- **Café privacy line:** `messages/en.json:1341` and `th.json:1341` say "More → Som's café". The card is now under More → Preferences.
- **Thai "change it later" hint:** `messages/th.json:824` says "แก้ได้ทุกเมื่อที่ More → ตั้งค่า". The tab is "เพิ่มเติม" (playtest R1 office #9), and the group is "ตั้งค่าเริ่มต้น". The bare "ตั้งค่า" reads as "การตั้งค่า" (Preferences), which is the wrong row.
- **Other Thai hints:** `th.json:801` and `:819` say "More" instead of "เพิ่มเติม".
- **Fix:**
  - EN: "More → Preferences → Som's café".
  - TH: "เพิ่มเติม → การตั้งค่า → ร้านกาแฟของส้ม" and "แก้ได้ทุกเมื่อที่ เพิ่มเติม → ตั้งค่าเริ่มต้น" (or the new Setup name, see D-5).
  - Use "เพิ่มเติม" in the other Thai hints.

### D-5 (S4) Thai group labels
- **Ambiguous names:** both titles contain "ตั้งค่า": Setup is "ตั้งค่าเริ่มต้น" and Preferences is "การตั้งค่า". "ตั้งค่าเริ่มต้น" also commonly reads as "default settings".
  - Consider "เริ่มต้นใช้งาน" for Setup.
- **Separators:** the hints use comma lists ("สัปดาห์ของคุณ, 10 นาทีแรก, ออกกำลังกาย"). The rest of `th.json` separates items with spaces ("โปรเจกต์ เดดไลน์ ขั้นตอน").
- **Wording:** the Preferences hint says "หน้าตา", but the card is titled "ธีม".
- **Duplicate heading:** in EN, `/more/setup` has the h1 "Setup" and then a first card whose h2 is also "Setup" (`more.setupTitle`).
  - Rename the card, for example to "Edit your setup", or drop its heading.

### D-6 (S4) Owner docs point to the old paths
- `docs/M12-share-setup.md:13` says "More → Share my free times". It is now More → Sharing → ….
- `docs/M11-push-setup.md:34` says "More → Notifications". It is now More → Preferences → Notifications.

### D-7 (S4) Gaps in `more.spec.ts`
- **Scrolling isn't proven:** anchors are checked with `toBeVisible()`, which passes even when the card is off-screen. Use `toBeInViewport()` to prove that Next scrolls to the card after `router.replace`, for example to `#notifications` and `#privacy`, which are low on their pages.
- **`#setup` isn't tested:** the comment says "#setup stays on More", but the test uses `#nope`.
- **The `#nope` assertion is weak:** the URL assertion passes before the effect has run.
- **No hash-bounce test:** add Set up 24/7 row → `/more/preferences#language` → "Back to More" → still on `/more`.

### D-8 (S4) Two sources of truth for the groups
- **Duplicated mapping:** `GROUP_CARDS` (`lib/more/groups.ts:9-14`) duplicates the JSX composition in `MoreGroupScreen`. The unit test only checks the list against itself.
  - Only the E2E catches a card moved in one place but not the other.
  - Consider rendering each group from `GROUP_CARDS` through an id→component map.
- **Icon:** the Data & account row uses `UploadIcon`, which reads as "upload".

### D-9 (S4) Judgment calls are not in DECISIONS.md
The workflow asks for judgment calls to be logged. None of these are:
- exercise is under Setup;
- Sound now comes before Notifications;
- Onboarding's "from=more" now returns to `/more/setup`;
- the new anchors `theme`, `account`, `setup-links`, `tips`, `cafe` and `export`.
