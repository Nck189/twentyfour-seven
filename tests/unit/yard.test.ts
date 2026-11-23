import { describe, expect, it } from "vitest";
import { YARD_SIZE, YARD_SPOTS } from "@/content/yard";
import { somSpotOfDay, visitors } from "@/lib/game/yard";

describe("farm yard rules (docs/FARM_YARD_PLAN.md)", () => {
  it("8 spots, numbered 1–8, inside the scene", () => {
    expect(YARD_SIZE).toBe(8);
    expect(YARD_SPOTS.map((s) => s.spot)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const s of YARD_SPOTS) {
      expect(s.x).toBeGreaterThan(0);
      expect(s.x).toBeLessThan(1);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(1);
    }
  });
  it("Som visits one placed item a day: the same all day, and only placed ones", () => {
    const placed = [2, 5, 7];
    const a = somSpotOfDay(placed, "2026-11-23");
    expect(placed).toContain(a);
    expect(somSpotOfDay([7, 2, 5], "2026-11-23")).toBe(a); // order doesn't matter
    const days = new Set(Array.from({ length: 20 }, (_, i) => somSpotOfDay(placed, `2026-12-${10 + i}`)));
    expect(days.size).toBeGreaterThan(1); // it changes from day to day
    expect(somSpotOfDay([], "2026-11-23")).toBeNull();
  });
  it("butterflies from 3 placed items, birds from 6", () => {
    expect(visitors(2)).toEqual({ butterflies: 0, birds: 0 });
    expect(visitors(3)).toEqual({ butterflies: 2, birds: 0 });
    expect(visitors(6)).toEqual({ butterflies: 3, birds: 2 });
    expect(visitors(8)).toEqual({ butterflies: 3, birds: 2 });
  });
});
