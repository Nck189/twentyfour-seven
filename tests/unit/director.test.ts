import { describe, expect, it } from "vitest";
import { STORY, STORY_BEATS } from "@/content/story";
import { nextBeat, triggerMet, type StoryFacts } from "@/lib/game/director";

const facts = (f: Partial<StoryFacts> = {}): StoryFacts => ({ harvests: 0, goodDays: 0, ...f });
const calm = { moment: "farm" as const, busy: false };

describe("director (docs/STORY.md rules)", () => {
  it("plays the first chapter on the first calm moment", () => {
    expect(nextBeat({ ...calm, seen: [], seenToday: false, facts: facts() })).toBe("ch0_gate");
  });

  it("never twice for the same chapter, in chapter order", () => {
    expect(nextBeat({ ...calm, seen: ["ch0_gate"], seenToday: false, facts: facts({ harvests: 2, goodDays: 5 }) })).toBe(
      "ch1_first_harvest",
    );
    expect(
      nextBeat({
        ...calm,
        seen: ["ch0_gate", "ch1_first_harvest"],
        seenToday: false,
        facts: facts({ harvests: 2, goodDays: 5 }),
      }),
    ).toBe("ch2_watering_can");
    expect(nextBeat({ ...calm, seen: [...STORY_BEATS], seenToday: false, facts: facts({ harvests: 9, goodDays: 9 }) })).toBeNull();
  });

  it("at most one beat a day", () => {
    expect(nextBeat({ ...calm, seen: ["ch0_gate"], seenToday: true, facts: facts({ harvests: 1 }) })).toBeNull();
  });

  it("only at calm moments: Farm or right after Goodnight, never while busy", () => {
    expect(nextBeat({ moment: "goodnight", busy: false, seen: [], seenToday: false, facts: facts() })).toBe("ch0_gate");
    expect(nextBeat({ moment: "farm", busy: true, seen: [], seenToday: false, facts: facts() })).toBeNull();
    expect(nextBeat({ moment: "other", busy: false, seen: [], seenToday: false, facts: facts() })).toBeNull();
  });

  it("waits for the condition in the data; a missed beat isn't lost, it plays later", () => {
    const seen = ["ch0_gate"];
    expect(nextBeat({ ...calm, seen, seenToday: false, facts: facts({ harvests: 0, goodDays: 3 }) })).toBe(
      "ch2_watering_can",
    );
    expect(nextBeat({ ...calm, seen: [...seen, "ch2_watering_can"], seenToday: false, facts: facts({ harvests: 1 }) })).toBe(
      "ch1_first_harvest",
    );
    expect(nextBeat({ ...calm, seen, seenToday: false, facts: facts({ harvests: 0, goodDays: 2 }) })).toBeNull();
  });

  it("triggers", () => {
    expect(triggerMet({ kind: "always" }, facts())).toBe(true);
    expect(triggerMet({ kind: "harvests", need: 1 }, facts({ harvests: 1 }))).toBe(true);
    expect(triggerMet({ kind: "good_days", need: 3 }, facts({ goodDays: 2 }))).toBe(false);
  });

  it("content: every beat has 3–5 panels and chapters are unique", () => {
    const chapters = STORY_BEATS.map((b) => STORY[b].chapter);
    expect(new Set(chapters).size).toBe(chapters.length);
    for (const b of STORY_BEATS) {
      expect(STORY[b].panels.length).toBeGreaterThanOrEqual(3);
      expect(STORY[b].panels.length).toBeLessThanOrEqual(5);
    }
  });
});
