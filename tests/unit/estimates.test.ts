import { describe, expect, it } from "vitest";
import { actualChoices, estimateSummary } from "@/lib/stats/estimates";

describe("estimate vs actual (M14)", () => {
  it("one-tap choices around the estimate, rounded to 5 min, no duplicates", () => {
    expect(actualChoices(30)).toEqual([15, 30, 45, 60, 90]);
    expect(actualChoices(10)).toEqual([5, 10, 15, 20, 30]);
    expect(actualChoices(5)).toEqual([5, 10, 15]);
  });

  it("needs 5 answered tasks; median ratio, share over, tags with 3+", () => {
    const t = (e: number, a: number | null, tag: string | null = null) => ({
      estimate_min: e,
      actual_min: a,
      tag,
    });
    expect(estimateSummary([t(30, 60), t(30, 30), t(30, null), t(0, 10)])).toBeNull();
    const s = estimateSummary([
      t(30, 60, "thesis"),
      t(30, 45, "thesis"),
      t(60, 120, "thesis"),
      t(20, 20, "chores"),
      t(10, 5),
    ])!;
    expect(s.n).toBe(5);
    expect(s.ratio).toBe(1.5);
    expect(s.overShare).toBeCloseTo(0.6);
    expect(s.byTag).toEqual([{ tag: "thesis", n: 3, ratio: 2 }]);
  });
});
