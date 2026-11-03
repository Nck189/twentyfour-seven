import { describe, expect, it } from "vitest";
import { ANIMAL_IDS, ANIMALS, EXERCISE_RULES as R, HATCH_RATES } from "@/content/animals";
import { RARITIES } from "@/content/crops";
import {
  addFeed,
  countedWorkouts,
  eggProgress,
  feedDaysLeft,
  hatchRoll,
  isFed,
  loveHearts,
  produceReady,
} from "@/lib/game/animals";

const DAY = 86_400_000;

describe("content", () => {
  it("every rarity has at least one animal and the hatch rates sum to 1", () => {
    for (const r of RARITIES) expect(ANIMAL_IDS.some((id) => ANIMALS[id].rarity === r)).toBe(true);
    expect(Object.values(HATCH_RATES).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });
});

describe("countedWorkouts", () => {
  it("counts ≥ 10 min, at most 2 in any rolling 24 h — no calendar or timezone midnight to game (R-M8-1)", () => {
    const logs = [
      { at: "2026-11-03T01:00:00Z", minutes: 30 },
      { at: "2026-11-03T02:00:00Z", minutes: 5 }, // too short
      { at: "2026-11-03T05:00:00Z", minutes: 20 },
      { at: "2026-11-03T18:00:00Z", minutes: 45 }, // 3rd within 24 h → not counted (even past local midnight)
      { at: "2026-11-04T01:30:00Z", minutes: 30 }, // 24.5 h after the 1st → counts
      { at: "2026-11-04T04:00:00Z", minutes: 30 }, // 05:00 still within 24 h → 2 in window → not counted
      { at: "2026-11-04T05:30:00Z", minutes: 30 }, // 05:00 left the window → counts
    ];
    expect(countedWorkouts(logs).map((l) => l.at)).toEqual([
      "2026-11-03T01:00:00Z",
      "2026-11-03T05:00:00Z",
      "2026-11-04T01:30:00Z",
      "2026-11-04T05:30:00Z",
    ]);
  });
});

describe("eggs and feed", () => {
  it("every 3rd counted workout hatches an egg", () => {
    expect(eggProgress(0)).toEqual({ progress: 0, hatched: 0 });
    expect(eggProgress(2)).toEqual({ progress: 2, hatched: 0 });
    expect(eggProgress(3)).toEqual({ progress: 0, hatched: 1 });
    expect(eggProgress(7)).toEqual({ progress: 1, hatched: 2 });
  });
  it("a workout adds 2 days on top of what's left, never from the past, capped at 14 days", () => {
    const now = new Date("2026-11-03T12:00:00Z");
    expect(addFeed(null, now, R.feedDaysPerWorkout).getTime()).toBe(now.getTime() + 2 * DAY);
    expect(addFeed(new Date(now.getTime() - 5 * DAY), now, 2).getTime()).toBe(now.getTime() + 2 * DAY);
    expect(addFeed(new Date(now.getTime() + 3 * DAY), now, 2).getTime()).toBe(now.getTime() + 5 * DAY);
    expect(addFeed(new Date(now.getTime() + 13 * DAY), now, 2).getTime()).toBe(now.getTime() + 14 * DAY);
  });
  it("hungry = sleepy, never dead; feed days left round up", () => {
    const now = new Date("2026-11-03T12:00:00Z");
    expect(isFed(null, now)).toBe(false);
    expect(isFed(new Date(now.getTime() - 1), now)).toBe(false);
    expect(isFed(new Date(now.getTime() + 1), now)).toBe(true);
    expect(feedDaysLeft(new Date(now.getTime() + 1.2 * DAY), now)).toBe(2);
    expect(feedDaysLeft(new Date(now.getTime() - DAY), now)).toBe(0);
  });
});

describe("produce and love", () => {
  const now = new Date("2026-11-03T12:00:00Z");
  const born = new Date(now.getTime() - 2 * DAY);
  it("a fed animal has produce once a day; a hungry one makes none", () => {
    const fed = new Date(now.getTime() + DAY);
    expect(produceReady({ fedUntil: fed, lastProduced: null, createdAt: born }, now)).toBe(true);
    expect(
      produceReady(
        { fedUntil: fed, lastProduced: new Date(now.getTime() - 3_600_000), createdAt: born },
        now,
      ),
    ).toBe(false);
    expect(
      produceReady({ fedUntil: new Date(now.getTime() - 1), lastProduced: null, createdAt: born }, now),
    ).toBe(false);
  });
  it("love shows as 0–5 hearts, one per 10 love, so the first heart comes within days (R-M8-7)", () => {
    expect([0, 9, 10, 25, 50, 100, 140].map(loveHearts)).toEqual([0, 0, 1, 2, 5, 5, 5]);
  });
});

describe("hatchRoll", () => {
  it("rates hold over 100k seeded rolls and every species can hatch", () => {
    let s = 42;
    const rand = () => ((s = (s * 1664525 + 1013904223) % 2 ** 32), s / 2 ** 32);
    const counts: Record<string, number> = {};
    const species = new Set<string>();
    for (let i = 0; i < 100_000; i++) {
      const h = hatchRoll(rand(), rand());
      counts[h.rarity] = (counts[h.rarity] ?? 0) + 1;
      species.add(h.species);
      expect(ANIMALS[h.species].rarity).toBe(h.rarity);
    }
    for (const r of RARITIES) expect(Math.abs(counts[r]! / 100_000 - HATCH_RATES[r])).toBeLessThan(0.006);
    expect(species.size).toBe(ANIMAL_IDS.length);
  });
  it("boundaries: r just under each cumulative edge", () => {
    expect(hatchRoll(0, 0).rarity).toBe("legendary");
    expect(hatchRoll(0.0199, 0).rarity).toBe("legendary");
    expect(hatchRoll(0.02, 0).rarity).toBe("epic");
    expect(hatchRoll(0.0699, 0.99).species).toBe("alpaca");
    expect(hatchRoll(0.07, 0).rarity).toBe("rare");
    expect(hatchRoll(0.2, 0).rarity).toBe("uncommon");
    expect(hatchRoll(0.5, 0).rarity).toBe("common");
    expect(hatchRoll(0.999999, 0.999999).species).toBe("bunny");
  });
});
