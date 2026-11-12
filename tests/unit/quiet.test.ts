import { describe, expect, it } from "vitest";
import { quietUntilFor, shouldPlay } from "@/lib/sound/quiet";

const at = (h: number, m = 0) => new Date(2026, 10, 12, h, m);

describe("auto-quiet during Focus and Work (docs/STORY.md sound plan)", () => {
  it("Focus and Work blocks are quiet until they end; other blocks aren't", () => {
    expect(quietUntilFor({ key: "focus", end: at(10) })).toBe(at(10).getTime());
    expect(quietUntilFor({ key: "work", end: at(18) })).toBe(at(18).getTime());
    expect(quietUntilFor({ key: "free", end: at(20) })).toBe(0);
    expect(quietUntilFor(null)).toBe(0);
  });

  it("plays unless muted, or quiet (when auto-quiet is on) and not essential", () => {
    const now = at(9).getTime();
    const quietUntil = at(10).getTime();
    expect(shouldPlay({ soundOn: true, autoQuiet: true, quietUntil, now })).toBe(false);
    expect(shouldPlay({ soundOn: true, autoQuiet: false, quietUntil, now })).toBe(true);
    expect(shouldPlay({ soundOn: true, autoQuiet: true, quietUntil, now: at(10, 1).getTime() })).toBe(true);
    // A timer the user set (power nap) still rings during a quiet block; mute silences everything.
    expect(shouldPlay({ soundOn: true, autoQuiet: true, quietUntil, now, essential: true })).toBe(true);
    expect(shouldPlay({ soundOn: false, autoQuiet: false, quietUntil: 0, now, essential: true })).toBe(false);
  });
});
