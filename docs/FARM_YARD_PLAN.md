# Farm yard — decor you place (Minnie, 2026-11-23)

Minnie: "decor feels pointless: it only lines up in a strip below the farm, and it can't be moved or removed." She chose the full redesign. Decor gets **places on the farm**, can be **moved** and **put away**, and gets **small reasons to buy** that never touch crops, tickets or coins.

## Rules
- **Spots.** The yard is a band below the plots with 8 fixed spots in two rows of 4 (`content/yard.ts`), numbered in reading order: the back row, then the front, each left to right. New decor fills them in that order. One decor item per spot.
- **Storage.** A decor row has a `spot` (1–8) or none (in storage). Nothing is ever deleted: putting an item away keeps it, and placing it again is free.
- **Buying.** A new item goes to the first free spot, or to storage when the yard is full. Earned decor (unlock ladder, story gifts) works the same way.
- **Moving.**
  - Tap a placed item: **Move to…** (pick a spot on a small map of the yard that shows what stands where; an item already there swaps back to where the first one came from) or **Put away**.
  - Tap an item in storage: pick a spot.
  - Drag-and-drop is not built yet (DECISIONS 2026-11-23): **Move to…** is one tap away.
- **Server-side.** Placing, moving and storing are security-definer RPCs that check `auth.uid()` and owner, and that spots are 1–8 and free (or swapped). The client never writes `decor` directly.
- **Existing accounts.** The migration gives each account's decor spots 1–8 in purchase order; the rest go to storage. Nothing is lost.

## Reasons to buy (cosmetic only)
- **Som visits decor.** On the Farm tab, Som sits next to one placed item, a different one each day (seeded by date, so it's stable within a day).
- **Visitors.** Butterflies come with 3+ placed items and birds with 6+, as small flat art drifting slowly. They're still under reduced motion and Skip animations.
- **The share picture.** The farm picture shows the placed decor in its spots.
- **Festival set.** Placing this month's festival item next to 2+ other items unlocks a short Som scene (a story beat, server-checked, no gift).

## Build order
1. Migration (`spot` column, unique per user and spot, backfill; `place_decor`, `store_decor`; `buy_decor` places into the first free spot) plus integration tests.
2. Pure yard logic (`lib/game/yard.ts`): first free spot, swap, Som's spot of the day, visitors by count. Unit tests.
3. Farm scene: decor drawn at its spots, the item sheet (Move to… / Put away), the storage tray, then drag. E2E, including "Move to…" with no drag.
4. Som visit, visitors, share picture, festival-set beat.
5. G7 review, QC report, PR. **Needs `db push` before merge.**
