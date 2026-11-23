# Review fix Phase F part 1 (F1–F3): G7 independent review

- **Scope:** `git show a44b423` ("Phase F part 1"), checked against `docs/REVIEW_FIX_PLAN.md` § Phase F (F1–F3), CLAUDE.md, and `docs/DECISIONS.md` (2026-11-23).
- **Reviewer:** a fresh G7 subagent with no implementation context. Read-only.
- **Date:** 2026-11-23.

## Verdict: PASS

There are no S1 or S2 findings. There are 4 S3 and 9 S4 findings. F-1 and F-2 should be fixed before merge. Both are small.

## What I ran
| Check | Result |
|---|---|
| `npx tsc --noEmit -p .` | clean |
| ESLint on the changed lib, components and test files | clean |
| `npx vitest run tests/unit` | 77 files, 454/454 pass |
| `npm run i18n:check` | 1296 keys, EN = TH |
| E2E | **Not run** (as instructed). UI findings come from reading the code. |

## Verified OK
- **Mute and quiet:**
  - Every new `sfx` entry goes through `play()`, so it obeys mute and the Focus/Work quiet block.
  - The ambience checks `soundOn`, `autoQuiet`, `quietUntil` and `visibilityState` on every call, read fresh from `usePrefs.getState()`.
  - `QuietClock` is mounted in `app/(app)/layout.tsx`, so quiet also holds on the Farm tab.
  - The switch is disabled while sound is off.
- **Ambience lifecycle:** the effect clears its one pending timer on unmount, when the switch turns off, and when the kind changes. Nothing leaks. It uses the single shared `AudioContext`. The compact iPad side panel passes `null`, so no ambience plays there.
- **Failure paths:**
  - Shop: sound only when `r.ok`.
  - Factory: build, start and collect play only when there is no error, or when `n > 0`.
  - Feed: munch only when `ok`.
  - Café: clink after the error return.
  - No double sound in the Shop (`Payoff` plays none).
- **growthSeen:**
  - Pure, and covered by unit tests.
  - Dead plots are excluded. A harvest drops the entry, and a replant has no prior entry, so neither counts as growth.
  - The compact side panel neither detects nor writes.
  - StrictMode is safe: the cleanup cancels the timer, so nothing is written twice.
  - A broken stored value counts as a first visit.
- **Animations:**
  - transform/opacity only.
  - Gated by `skipAnimations`. The global reduced-motion rule (`globals.css:91`) ends them at once, and the end state is identity (grow-step) or hidden (petals).
  - Petals: `-z-10` inside a `relative isolate overflow-hidden` section paints above the section background and below the content. `pointer-events-none` and `aria-hidden` are set.
  - The coin fly is absolute plus transform inside a fixed `pointer-events-none` banner, so there is no layout shift.
  - Strip bounce keys (`${b}-${n}`, `som-${n}`) remount, so a second finish replays the bounce.
- **Tests and helpers:**
  - `setPrefs`: `skipAnimations: !p.animations` stays `true` for every spec that doesn't pass `animations`, so other specs are unchanged.
  - The recipe test really checks key, length and gain.
- **Look, a11y and i18n:**
  - Art: token colours only, no black, no outlines.
  - The new Toggle reuses `role="switch"`, `aria-checked` and `min-h-11`.
  - Thai "เสียงในฟาร์ม" / "นกร้องตอนกลางวัน จิ้งหรีดตอนกลางคืน เฉพาะหน้าฟาร์ม" reads naturally. ("เฉพาะในหน้าฟาร์ม" would be a touch smoother; optional.)

## Findings

### S3

**F-1 · S3 · `lib/sound/sfx.ts:13-22, 39-42, 61-75`; `lib/sound/ambience.ts:61`: sounds pile up while the AudioContext isn't running, then burst on the first tap.**
- **What happens:**
  - `audio()` creates the context outside a gesture when nothing has unlocked it yet, for example on a reload or deep link to `/farm`. Under the iOS and Chrome autoplay rules that context stays `suspended`. On iOS it can also be `interrupted` after backgrounding or a call, and `audio()` only resumes `suspended`.
  - `currentTime` is frozen while the context isn't running. So every `schedule()` puts its oscillators at the same `t0 ≈ 0.01`.
  - The ambience loop keeps scheduling: crickets about 45 calls a minute, birds about 16. On the first tap, `unlockAudio` resumes the context and every queued call plays at once. A minute of crickets is about 135 oscillators summing to gain ≈ 1.6, a harsh click.
  - The same thing, smaller, happens with one-shot non-gesture sounds: `sfx.grow` on load, the StreakNotice `celebrate`, and the restored-pending `sfx.error`. Each plays late, on an unrelated tap.
- **Fix:**
  - In `schedule()`, or at least in `playNotes`, return when `ac.state !== "running"`.
  - In `audio()`, resume on any state other than `running` (which covers `interrupted`).
  - Add a unit test with a fake AudioContext.

**F-2 · S3 · `components/farm/AnimalPen.tsx:92-94`: a failed pet plays "that's enough".**
- **What happens:** `actions.pet` returns `false` on an RPC or network error as well as for "not counted". So a failure plays `sfx.enough()` and shows `petEnough`. The text is pre-existing, but the new sound now confirms the wrong message.
- **Fix:** have `pet` return `true | false | null`, with `null` meaning an error. On `null`, show `t("error")` and play `sfx.error()` or nothing. Add a test first.

**F-3 · S3 · `components/farm/DecorShop.tsx:57-63`: buying decor is silent.**
- **What happens:** F1 is "a sound for everything that changes something", and Buy is in the plan. Seeds, upgrades, the ticket swap and redeem now "kaching", but a decor purchase spends coins in silence. The SOUND-MAP row doesn't mention decor.
- **Fix:** `if (ok) sfx.buy()` after `onBuy`, and add decor to the map row.

**F-4 · S3 · plan F1 "Tests": the required "plays nothing when muted or quiet" test is missing for `sfx` and the ambience.**
- **What happens:** only `shouldPlay` is tested (`tests/unit/quiet.test.ts`). Nothing asserts that each `sfx` entry is silent when muted or quiet. Nothing covers the ambience's own gate (visibility + `shouldPlay` + `playNotes`, which skips every guard).
- **Fix:**
  - Add a unit test with a stubbed `AudioContext` that calls every `sfx` entry with `soundOn: false`, then inside a quiet block, and expects zero oscillators. The one exception is `alarm` in a quiet block.
  - Extract the ambience tick's "audible" check into a pure function and test it.

### S4

**F-5 · S4 · `components/farm/FarmScreen.tsx:178-179`, `lib/farm/growthSeen.ts:575-581`: the snapshot is keyed `"device"`, not by user.**
- **What happens:** a second account on the same device is compared against the first account's farm. That gives a false pop and step-up when the same crop, at the same star, sits in the same slot at a higher stage.
- **What else is off:**
  - `plantedKey` is the seed's star, not the planting. `PlotView` has no `plantedOn`, though `useFarm` reads `planted_on`.
  - `writeSeen` overwrites the whole store object.
- **Fix:**
  - Key the snapshot by `uid`, which `useFarm` already has, and merge on write.
  - Optionally expose `plantedOn`/`harvestedOn` on `PlotView` and use it as `plantedKey`.

**F-6 · S4 · `components/farm/FarmScreen.tsx:159-186, 301-310`, `app/globals.css:114`: `grown` is never cleared, and `animation-fill-mode: both` blocks the press feedback.**
- **What happens:**
  - After the step-up, the final keyframe's `transform` keeps overriding `.tap:active { transform: scale(0.96) }`. A grown plot loses its press feedback for the rest of the visit.
  - `data-grew` stays on after a harvest.
- **Fix:** use `animation-fill-mode: backwards`, or clear `grown` on `animationend` / after the last delay.

**F-7 · S4 · `components/farm/Shop.tsx:182-189`, `app/globals.css:131-133`, `components/streak/StreakChip.tsx:396`: two animations run past 600 ms end to end.**
- **What happens:**
  - Coin fly: 0.5 s + 0.14 s delay = 640 ms.
  - Petals: 560 ms + 120 ms delay = 680 ms.
- **Also:** the coins rise from a fixed 140 px below the payoff banner into the banner's coin. They don't fly "from the item to the coin counter" (plan F2), and the comment at `Shop.tsx:180` ("from where the row was tapped") is inaccurate.
- **Fix:** cut the durations so that delay + duration ≤ 600 ms, and correct the comment, or log the deviation.

**F-8 · S4 · `components/today/BlockCheckin.tsx:330`: the "all ticked" check counts items instead of matching ids.**
- **What happens:** `items_done.length >= checklist.length` counts stale ids from items deleted after they were ticked, so three notes can play while a current item is still unticked.
- **Fix:** `block.checklist.every((i) => log.items_done.includes(i.id))`.
- **Related:** the sound and `emitBlockDone` fire before `actions.close` resolves, so a failed close plays "done", bounces the strip, then plays the error note. This is the optimistic pattern used elsewhere, so it is only noted here.

**F-9 · S4 · `components/today/TodayScreen.tsx:94-98`: `sfx.error` fires on app open when failed saves are restored from storage.**
- **What happens:** the restore takes `saveError` from 0 to N with no user action. A failed auto-replay then plays it a second time (`retrySave` goes 0 → N). Before the audio unlock, this also falls under F-1.
- **Fix:** seed `savesFailed` after the first restore, or only sound on increases caused by a user action.

**F-10 · S4 · `tests/unit/sound-map.test.ts:34`: the call-site check works per sound, not per moment, and can't see `sfx[sound]()`.**
- **What happens:** the Shop's `buy` and `deliver` calls are dynamic. The test passes only because `FactorySheet` calls `sfx.buy` and `sfx.deliver` once each, so removing the Shop path wouldn't fail it. The `^ {2}(\w+): ` name scan would also miss an entry written as a method shorthand.
- **Fix:** acceptable as a smoke test. Optionally add a `shopSound` call-site assertion for `Shop.tsx`, or list a file per moment in the map.

**F-11 · S4 · `lib/sound/ambience.ts:43-66`, `components/farm/FarmScreen.tsx:167`: the ambience doesn't follow the sky.**
- **What happens:** the kind comes from `data.sky`, which is computed at farm load. A farm left open across dusk keeps playing birds until the next reload.
- **Also:** the ambience isn't listed in `docs/SOUND-MAP.md`. `playNotes` is an exported, unguarded path. Move the guard inside it, or document it as ambience-only.

**F-12 · S4 · `components/today/FarmStrip.tsx:22-24, 48-59`: the strip bounce is late if the strip has no data yet, and Som doesn't "look up".**
- **What happens:**
  - A finish within the first 2 s after Today opens (the farm read waits `delayMs: 2000`) stores `done`. The bounce then plays when the data arrives.
  - Som bounces instead of looking up as the plan describes.
- **Fix:** ignore the event while `data` is null. Log the "looks up" simplification in DECISIONS.

**F-13 · S4 · `tests/e2e/rewards.spec.ts:57-58`: the reduced-motion check is weak.**
- **What happens:**
  - The keyframe start and end are identity, and only grown plots after the first have a delay. So the computed-transform assertion depends on sampling mid-animation for plot 0.
  - `app/dev/farm/FarmPreview.tsx` renders a non-compact `FarmView` with an inline `data` object. In dev, it writes the sample farm into the real device snapshot and can play ambience.
- **Fix:**
  - Also assert the computed `animationDuration` is ≈ 0, or `getAnimations()` is empty or finished.
  - Gate the growth and ambience hooks off for the preview, for example with a `preview` prop.

## E2E time-of-day review (static)
- **Grow specs:** `wakeDay()` matches the 10:00 template. Yesterday is relative to the wake day. Nothing taps under an overlay, and the assertions are attribute and class checks that stay true after the animation, so they are not time-sensitive.
- **Strip bounce spec:** skipped between 00:00 and 01:40 Bangkok time. It uses `dismissNightOffer` and waits for the strip, up to 15 s, before finishing. That looks robust.
