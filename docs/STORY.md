# Story events: the orange cat (draft)

Minnie's call (2026-11-12): milestone events with short cutscenes, told by an **orange farm cat**. Built **after the economy PR and before M11**. This is a draft for her to read; nothing is final until she OKs the beats and the cat's name.

## The cat
- **Who:** an orange tabby who lived on the old farm before you came. Curious, a bit lazy, very loyal. Never judges and never nags. It naps when you're away and is happy when you come back.
- **Name:** Minnie picks it (ideas: ส้มจี๊ด / Som, ข้าวตัง, Mango).
- **Art:**
  - Built like the other animals: flat, no outlines, 3 tones, light from the top-left, readable at 48 px.
  - Poses: sit, sleep, stretch, happy, look-up, carry-seed.
- **Where it shows up:**
  - cutscenes;
  - the welcome-back card (R3);
  - the M11 pushes ("ส้มจี๊ดรออยู่นะ");
  - sometimes napping on the farm scene.

## Chapters (one beat each, unlocked by real progress)
| # | When (data) | Beat (one line) | Gift |
|---|---|---|---|
| 0 | First open after setup | The cat finds you at the overgrown gate. | — |
| 1 | First harvest | The cat sniffs the produce and claims a radish leaf. | 1 seed |
| 2 | 3 minimum days | It brings you an old watering can from the shed. | 1 ticket |
| 3 | First animal hatched | It is jealous of the chick, then they nap together. | — |
| 4 | Streak 7 | A stroll at sunset; the farm sign gets repainted. | decor: farm sign |
| 5 | Farmhouse Lv 1 | It moves into the house and takes the best cushion. | — |
| 6 | 30 days used (not a streak) | A photo album of your month on the wall. | 2 tickets |
| 7 | Each season's festival | A short seasonal scene (Songkran, Loy Krathong, …). | festival decor discount |
| R | Back after a lapse | The cat wakes up, stretches, and is glad to see you (replaces the plain card text). | the existing +1 ticket |

## Rules for the director
Pure logic in `lib/game/director.ts`; the server records what was seen.
- At most **one beat a day**, and never twice for the same chapter.
- Plays only at **calm moments**: opening the Farm tab, or right after Goodnight. Never during the wake window, Down Time or a running block's check-in.
- **Always skippable** (tap or Skip). With reduced motion it plays as still panels. Muted with the global mute.
- **No feature is locked behind a beat** and nothing is time-limited, so missing a beat loses nothing: it waits for the next calm moment.
- Gifts are granted by a `claim_story_beat(id)` RPC that checks the condition from data. The client never decides.
- Each beat logs an event (`story_seen`).

## Cutscene format
- 3–5 panels, 10–20 s in all.
- Each panel is an SVG scene (farm parts already exist) plus one line of text from i18n (EN/TH, short), with a soft motion: pan, the cat's pose change, sparkles.
- Scripts are typed data in `content/story.ts`: `{ id, trigger, panels: [{ scene, pose, lineKey, motion }], gift }`.

## Build order
1. The cat's art (6 poses) and the `story_seen` table + RPCs.
2. The director (unit tests: one a day, calm moments only, no repeats, condition checks) and the cutscene player (reduced-motion and skip E2E).
3. Chapters 0–2, then the rest one at a time.
