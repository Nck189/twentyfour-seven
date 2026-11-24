import { describe, expect, it } from "vitest";
import { YARD_SIZE, YARD_SPOTS } from "@/content/yard";
import { somGap, somSpotOfDay, visitorPlaces, visitors } from "@/lib/game/yard";

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
  it("spots read in order: two rows of 4, back then front, each left to right (Minnie 2026-11-24)", () => {
    const rows = [YARD_SPOTS.slice(0, 4), YARD_SPOTS.slice(4)];
    for (const row of rows) {
      expect(new Set(row.map((s) => s.y)).size).toBe(1); // one line per row
      const xs = row.map((s) => s.x);
      expect(xs).toEqual([...xs].sort((a, b) => a - b)); // left to right
      // evenly spaced
      const gaps = xs.slice(1).map((x, i) => +(x - xs[i]!).toFixed(3));
      expect(new Set(gaps).size).toBe(1);
    }
    expect(rows[0]![0]!.y).toBeLessThan(rows[1]![0]!.y); // the back row is first
    // a spot in the front row sits right in front of the one behind it, so the picker's 4×2 grid
    // is a map of the yard
    expect(rows[1]!.map((s) => s.x)).toEqual(rows[0]!.map((s) => s.x));
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
  it("visitors never stand on Som, whichever spot he picks (G7 TS S3-3)", () => {
    for (let spot = 1; spot <= 8; spot++) {
      const som = somGap(spot)!;
      const at = visitorPlaces(spot, { butterflies: 3, birds: 2 });
      expect(at.birds).toHaveLength(2);
      expect(at.butterflies).toHaveLength(3);
      for (const b of at.butterflies) expect(Math.abs(b - som.x)).toBeGreaterThan(0.1);
      if (som.front) for (const b of at.birds) expect(Math.abs(b - som.x)).toBeGreaterThan(0.1);
    }
  });
});
