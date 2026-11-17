import { describe, expect, it } from "vitest";
import { retention, weekOf } from "@/lib/stats/retention";

describe("retention cohorts (G3)", () => {
  it("weeks start on Monday", () => {
    expect(weekOf("2026-11-16")).toBe("2026-11-16"); // Mon
    expect(weekOf("2026-11-22")).toBe("2026-11-16"); // Sun
    expect(weekOf("2026-11-23")).toBe("2026-11-23");
  });

  it("D1/D7/D14/D30 = share active that day; only days that have come count", () => {
    const users = [
      { id: "a", signup: "2026-10-01" },
      { id: "b", signup: "2026-10-02" },
      { id: "c", signup: "2026-11-15" },
    ];
    const active = new Map([
      ["a", new Set(["2026-10-02", "2026-10-08", "2026-10-31"])],
      ["b", new Set(["2026-10-03"])],
      ["c", new Set(["2026-11-16"])],
    ]);
    const out = retention(users, active, "2026-11-16");
    expect(out.map((c) => c.week)).toEqual(["2026-11-09", "2026-09-28"]);
    const oct = out[1]!;
    expect(oct.n).toBe(2);
    expect(oct.rate).toEqual({ 1: 1, 7: 0.5, 14: 0, 30: 0.5 });
    const nov = out[0]!;
    expect(nov.rate).toEqual({ 1: 1, 7: null, 14: null, 30: null });
  });
});
