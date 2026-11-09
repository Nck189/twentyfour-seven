import { describe, expect, it } from "vitest";
import type { TipId } from "@/content/tips";
import { activeTip } from "@/lib/tips/tips";

const s = (...ids: TipId[]) => new Set<TipId>(ids);

describe("activeTip (one tip at a time, each once)", () => {
  it("shows the first unseen tip on screen, in priority order", () => {
    expect(activeTip(s("exercise", "wake"), s(), false, false)).toBe("wake");
    expect(activeTip(s("exercise", "wake"), s("wake"), false, false)).toBe("exercise");
    expect(activeTip(s("plan"), s(), false, false)).toBe("plan");
  });
  it("nothing when all seen, tips are off, or one was just dismissed on this screen", () => {
    expect(activeTip(s("wake"), s("wake"), false, false)).toBeNull();
    expect(activeTip(s("wake"), s(), true, false)).toBeNull();
    expect(activeTip(s("wake", "first10"), s(), false, true)).toBeNull();
    expect(activeTip(s(), s(), false, false)).toBeNull();
  });
});
