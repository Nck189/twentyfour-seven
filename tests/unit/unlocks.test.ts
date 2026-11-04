import { describe, expect, it } from "vitest";
import { UNLOCK_IDS } from "@/content/unlocks";
import { nextUnlock, unlockProgress } from "@/lib/game/unlocks";

describe("unlock ladder progress (SPEC §8.8b)", () => {
  it("counts toward each goal, capped; granted ones are done", () => {
    const p = unlockProgress({ nights: 0, first10s: 13, best_streak: 9, blocks_closed: 250 }, [
      "first_backlog",
    ]);
    const by = Object.fromEntries(p.map((x) => [x.id, x]));
    expect(by.first_night).toMatchObject({ have: 0, need: 1, done: false, left: 1 });
    expect(by.first_backlog!.done).toBe(true);
    expect(by.first10_20).toMatchObject({ have: 13, left: 7 });
    expect(by.streak_7!.done).toBe(true);
    expect(by.streak_30).toMatchObject({ have: 9, left: 21 });
    expect(by.blocks_100).toMatchObject({ have: 100, done: true });
    expect(p.map((x) => x.id)).toEqual([...UNLOCK_IDS]);
  });
  it("the next unlock is the one closest to done", () => {
    const p = unlockProgress({
      nights: 1,
      backlog_done: 1,
      all_first10_days: 1,
      first10s: 18,
      must_done: 2,
      best_streak: 3,
    });
    expect(nextUnlock(p)!.id).toBe("first10_20");
    expect(
      nextUnlock(
        unlockProgress({
          nights: 1,
          backlog_done: 1,
          all_first10_days: 1,
          first10s: 20,
          must_done: 10,
          best_streak: 30,
          blocks_closed: 100,
        }),
      ),
    ).toBeNull();
  });
});
