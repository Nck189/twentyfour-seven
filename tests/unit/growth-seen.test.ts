import { describe, expect, it } from "vitest";
import { grownSince, snapshot } from "@/lib/farm/growthSeen";

const plot = (cropId: string, stage: number, plantedKey = "a") => ({ cropId, stage, plantedKey });

describe("crops that grew since the last farm visit (review fix F1/F2)", () => {
  it("the first visit on a device shows nothing grown", () => {
    expect(grownSince(null, { focus: plot("tomato", 2) })).toEqual([]);
  });
  it("a higher stage of the same planting grew; the same or a lower one didn't", () => {
    const before = snapshot({ focus: plot("tomato", 1), work: plot("corn", 2), free: plot("pea", 3) });
    const now = { focus: plot("tomato", 2), work: plot("corn", 2), free: plot("pea", 3) };
    expect(grownSince(before, now)).toEqual(["focus"]);
  });
  it("a new planting in a plot is not growth; plots keep day order", () => {
    const before = snapshot({ wake: plot("tomato", 1, "a"), sleep: plot("corn", 0) });
    const now = { wake: plot("tomato", 2, "b"), sleep: plot("corn", 1), focus: plot("pea", 1) };
    expect(grownSince(before, now)).toEqual(["sleep"]);
  });
  it("reads only what it wrote (a broken saved value counts as a first visit)", () => {
    expect(grownSince({ focus: "nonsense" } as never, { focus: plot("tomato", 2) })).toEqual([]);
  });
});
