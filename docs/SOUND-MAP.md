# Sound map

Every moment that changes something has a sound (review fix F1). A new feature picks a sound from this list. If none fits, add one to `lib/sound/recipes.ts` (C major, short, soft) and a row here.

The test `tests/unit/sound-map.test.ts` reads this table:
- Each `sfx.<name>` below must be called somewhere in `app/`, `components/` or `lib/`.
- Every sound in `sfx` must be listed here.

All sounds obey the global mute and "Quiet during Focus and Work". The one exception is `sfx.alarm`, a timer the user set: it still rings in a quiet block, but never when muted.

| Moment | Sound |
|---|---|
| Tick a checklist item, a task, a reason in the Night ritual | `sfx.tick` |
| Untick | `sfx.untick` |
| Start a block | `sfx.blockStart` |
| First 10 minutes done | `sfx.sparkle` |
| Finish a block (three notes when every checklist item is ticked) | `sfx.blockDone` |
| "I'm up" inside the window | `sfx.sunrise` |
| Night ritual: each step | `sfx.ritualStep` |
| Goodnight | `sfx.lullaby` |
| Plant a seed (one plot or all) | `sfx.plant` |
| Crops grew since the last farm visit (one pop per plot) | `sfx.grow` |
| Harvest | `sfx.harvest` |
| Sell, coins earned | `sfx.coin` |
| Buy a seed, upgrade, swap coins for a ticket, redeem a reward | `sfx.buy` |
| Deliver an order, collect from the factory | `sfx.deliver` |
| Start a factory job | `sfx.machine` |
| Order at the café | `sfx.clink` |
| Feed an animal | `sfx.munch` |
| Pet an animal | `sfx.animal` |
| Pets used up for today | `sfx.enough` |
| Collect an animal's produce, a small win | `sfx.pop` |
| Capsule machine shaking, cracking, the reveal | `sfx.shake`, `sfx.crack`, `sfx.jingle` |
| An egg hatches | `sfx.hatch` |
| Something failed to save | `sfx.error` |
| Unlock, streak milestone, perfect day, welcome back | `sfx.celebrate` |
| Som speaks in a story scene | `sfx.meow` |
| A timer the user set (power nap, phone away) | `sfx.alarm` |
