import { describe, expect, it } from "vitest";
import { ambienceCall, ambienceGap, ambienceKind } from "@/lib/sound/ambience";
import { C_MAJOR } from "@/lib/sound/recipes";

describe("farm ambience (review fix F3)", () => {
  it("birds by day and at sunrise, crickets at dusk and night", () => {
    expect(ambienceKind("day")).toBe("birds");
    expect(ambienceKind("sunrise")).toBe("birds");
    expect(ambienceKind("dusk")).toBe("crickets");
    expect(ambienceKind("night")).toBe("crickets");
  });
  it("each call is very soft, short and in the same key as every other sound", () => {
    for (const kind of ["birds", "crickets"] as const)
      for (const v of [0, 1])
        for (const n of ambienceCall(kind, v)) {
          expect(C_MAJOR).toContain(n.freq);
          if ("to" in n && n.to) expect(C_MAJOR).toContain(n.to);
          expect(n.gain).toBeLessThanOrEqual(0.03);
          expect(n.at + n.dur).toBeLessThan(0.3);
        }
  });
  it("calls are spaced out, never a wall of sound", () => {
    expect(ambienceGap("birds", 0)).toBeGreaterThanOrEqual(2.5);
    expect(ambienceGap("birds", 1)).toBeLessThanOrEqual(5);
    expect(ambienceGap("crickets", 0)).toBeGreaterThanOrEqual(1);
  });
});
