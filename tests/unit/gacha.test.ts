import { describe, expect, it } from "vitest";
import { CROPS } from "@/content/crops";
import { PITY, RATES } from "@/content/gacha";
import { NO_PITY, legendaryChance, roll, simulate } from "@/lib/game/gacha";

/** Seeded PRNG (mulberry32) so the 100k simulation is repeatable. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("gacha rolls (SPEC §8.5)", () => {
  it("base rates when no pity applies", () => {
    expect(roll(NO_PITY, 0.004, 0).rarity).toBe("legendary");
    expect(roll(NO_PITY, 0.006, 0).rarity).toBe("epic");
    expect(roll(NO_PITY, 0.03, 0).rarity).toBe("epic");
    expect(roll(NO_PITY, 0.031, 0).rarity).toBe("rare");
    expect(roll(NO_PITY, 0.2, 0).rarity).toBe("uncommon");
    expect(roll(NO_PITY, 0.5, 0).rarity).toBe("common");
    expect(Object.values(RATES).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
  it("pity: 10th pull rare+, 30th epic+, soft legendary from 61, hard at 80", () => {
    expect(roll({ since_rare: 9, since_epic: 9, since_legendary: 9 }, 0.99, 0).rarity).toBe("rare");
    expect(roll({ since_rare: 5, since_epic: 29, since_legendary: 29 }, 0.99, 0).rarity).toBe("epic");
    expect(legendaryChance({ ...NO_PITY, since_legendary: 59 })).toBe(RATES.legendary);
    expect(legendaryChance({ ...NO_PITY, since_legendary: 60 })).toBeCloseTo(
      RATES.legendary + PITY.legendarySoftStep,
    );
    expect(roll({ since_rare: 0, since_epic: 0, since_legendary: 79 }, 0.999, 0).rarity).toBe("legendary");
  });
  it("counters reset by tier: a legendary resets all three, a rare only the rare one", () => {
    expect(roll({ since_rare: 4, since_epic: 12, since_legendary: 40 }, 0.0, 0).pity).toEqual(NO_PITY);
    expect(roll({ since_rare: 4, since_epic: 12, since_legendary: 40 }, 0.05, 0).pity).toEqual({
      since_rare: 0,
      since_epic: 13,
      since_legendary: 41,
    });
  });
  it("the crop is one of that rarity's four, spread evenly by the second number", () => {
    const seen = new Set([0, 0.26, 0.51, 0.99].map((c) => roll(NO_PITY, 0.5, c).cropId));
    expect(seen.size).toBe(4);
    seen.forEach((id) => expect(CROPS[id].rarity).toBe("common"));
  });
});

describe("100k simulated pulls (BUILD_PLAN M7 done-when)", () => {
  const sim = simulate(100_000, rng(24_7));
  const share = (k: keyof typeof sim.counts) => sim.counts[k] / 100_000;
  it("pity is never exceeded", () => {
    expect(sim.longestWithoutRare).toBeLessThanOrEqual(PITY.rare - 1);
    expect(sim.longestWithoutEpic).toBeLessThanOrEqual(PITY.epic - 1);
    expect(sim.longestWithoutLegendary).toBeLessThanOrEqual(PITY.legendary - 1);
  });
  it("effective rates: base rates plus what pity adds, within tolerance", () => {
    // Pity only moves pulls upward: common/uncommon a bit below base, rare+ a bit above.
    expect(share("common")).toBeGreaterThan(0.55);
    expect(share("common")).toBeLessThan(RATES.common);
    expect(share("legendary")).toBeGreaterThan(RATES.legendary);
    expect(share("legendary")).toBeLessThan(0.025);
    expect(share("epic")).toBeGreaterThan(RATES.epic);
    expect(share("epic")).toBeLessThan(0.05);
    // A long independent run agrees within 10% per rarity (the rates are stable, not luck).
    const ref = simulate(1_000_000, rng(99));
    for (const k of Object.keys(sim.counts) as (keyof typeof sim.counts)[]) {
      expect(Math.abs(share(k) - ref.counts[k] / 1_000_000) / (ref.counts[k] / 1_000_000)).toBeLessThan(0.1);
    }
  });
  it("about one Legendary a month at ~2.5 tickets a day (SPEC target)", () => {
    const pullsPerLegendary = 100_000 / sim.counts.legendary;
    expect(pullsPerLegendary).toBeGreaterThan(45);
    expect(pullsPerLegendary).toBeLessThan(80);
  });
});
