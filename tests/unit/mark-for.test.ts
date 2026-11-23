import { describe, expect, it } from "vitest";
import { markFor } from "@/lib/today/markFor";

describe("Som in Today's header follows the block (review fix F4)", () => {
  it("sunrise, day, dusk, night", () => {
    expect(markFor("wake")).toBe("sunrise");
    for (const b of ["focus", "work", "gradation", "free"] as const) expect(markFor(b)).toBe("meadow");
    expect(markFor("down")).toBe("dusk");
    expect(markFor("sleep")).toBe("night");
    expect(markFor(null)).toBe("meadow");
  });
});
