import { describe, expect, it } from "vitest";
import { WEEK_PICTURE_SLOTS, resolveVars, varNames } from "@/lib/share/weekPicture";

const tokens = new Map([
  ["--art-shadow", "#cdbfa6"],
  ["--art-leaf-1", "#a6d08f"],
  ["--shadow-on", ""],
]);

describe("week picture: tokens are inlined into the SVG art (no black, G4)", () => {
  it("resolves plain, fallback and nested vars; an unset var takes its fallback", () => {
    expect(resolveVars('fill="var(--art-leaf-1)"', tokens)).toBe('fill="#a6d08f"');
    // The farm shadow: an unset --shadow-on falls back to --art-shadow (it rendered black before).
    expect(resolveVars('fill="var(--shadow-on, var(--art-shadow))"', tokens)).toBe('fill="#cdbfa6"');
    expect(resolveVars('fill="var(--nope, #fff)"', tokens)).toBe('fill="#fff"');
    expect(resolveVars('fill="var(--nope)"', tokens)).toBe('fill="transparent"');
  });
  it("every farm piece stands on the ground, none floats (Minnie: the house floated)", () => {
    for (const [slot, [, y, size]] of Object.entries(WEEK_PICTURE_SLOTS)) {
      if (slot === "streak") continue;
      const feet = y + size * (41 / 48);
      expect(Math.abs(feet - 472), slot).toBeLessThanOrEqual(1);
    }
  });
  it("lists every token, nested ones too", () => {
    expect([...varNames('a="var(--shadow-on, var(--art-shadow))" b="var(--art-leaf-1)"')].sort()).toEqual([
      "--art-leaf-1",
      "--art-shadow",
      "--shadow-on",
    ]);
  });
});
