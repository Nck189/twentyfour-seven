import { describe, expect, it } from "vitest";
import { PLANTING_DAYS } from "@/content/seasonal";
import { STORY, STORY_BEATS } from "@/content/story";
import { beatKey, nextBeat, triggerMet, type StoryFacts } from "@/lib/game/director";

const facts = (f: Partial<StoryFacts> = {}): StoryFacts => ({ harvests: 0, goodDays: 0, ...f });
const calm = { moment: "farm" as const, busy: false };

describe("director (docs/STORY.md rules)", () => {
  it("plays the first chapter on the first calm moment", () => {
    expect(nextBeat({ ...calm, seen: [], seenToday: false, facts: facts() })).toBe("ch0_gate");
  });

  it("never twice for the same chapter, in chapter order", () => {
    expect(
      nextBeat({ ...calm, seen: ["ch0_gate"], seenToday: false, facts: facts({ harvests: 2, goodDays: 5 }) }),
    ).toBe("ch1_first_harvest");
    expect(
      nextBeat({
        ...calm,
        seen: ["ch0_gate", "ch1_first_harvest"],
        seenToday: false,
        facts: facts({ harvests: 2, goodDays: 5 }),
      }),
    ).toBe("ch2_watering_can");
    expect(
      nextBeat({
        ...calm,
        seen: [...STORY_BEATS],
        seenToday: false,
        facts: facts({ harvests: 9, goodDays: 9 }),
      }),
    ).toBeNull();
  });

  it("at most one beat a day", () => {
    expect(
      nextBeat({ ...calm, seen: ["ch0_gate"], seenToday: true, facts: facts({ harvests: 1 }) }),
    ).toBeNull();
  });

  it("only at calm moments: Farm or right after Goodnight, never while busy", () => {
    expect(nextBeat({ moment: "goodnight", busy: false, seen: [], seenToday: false, facts: facts() })).toBe(
      "ch0_gate",
    );
    expect(nextBeat({ moment: "farm", busy: true, seen: [], seenToday: false, facts: facts() })).toBeNull();
    expect(nextBeat({ moment: "other", busy: false, seen: [], seenToday: false, facts: facts() })).toBeNull();
  });

  it("waits for the condition in the data; a missed beat isn't lost, it plays later", () => {
    const seen = ["ch0_gate"];
    expect(nextBeat({ ...calm, seen, seenToday: false, facts: facts({ harvests: 0, goodDays: 3 }) })).toBe(
      "ch2_watering_can",
    );
    expect(
      nextBeat({
        ...calm,
        seen: [...seen, "ch2_watering_can"],
        seenToday: false,
        facts: facts({ harvests: 1 }),
      }),
    ).toBe("ch1_first_harvest");
    expect(
      nextBeat({ ...calm, seen, seenToday: false, facts: facts({ harvests: 0, goodDays: 2 }) }),
    ).toBeNull();
  });

  it("triggers", () => {
    expect(triggerMet({ kind: "always" }, facts())).toBe(true);
    expect(triggerMet({ kind: "harvests", need: 1 }, facts({ harvests: 1 }))).toBe(true);
    expect(triggerMet({ kind: "good_days", need: 3 }, facts({ goodDays: 2 }))).toBe(false);
    expect(triggerMet({ kind: "hatched", need: 1 }, facts())).toBe(false);
    expect(triggerMet({ kind: "hatched", need: 1 }, facts({ hatched: 1 }))).toBe(true);
    expect(triggerMet({ kind: "best_streak", need: 7 }, facts({ bestStreak: 6 }))).toBe(false);
    expect(triggerMet({ kind: "best_streak", need: 7 }, facts({ bestStreak: 7 }))).toBe(true);
    expect(triggerMet({ kind: "days_used", need: 30 }, facts({ daysUsed: 30 }))).toBe(true);
    expect(triggerMet({ kind: "house", need: 2 }, facts({ house: 1 }))).toBe(false);
  });

  it("chapters 3–6 and the café opening, in order, each when its data is there", () => {
    const base = ["ch0_gate", "ch1_first_harvest", "ch2_watering_can"];
    const all = facts({ harvests: 9, goodDays: 9, hatched: 1, bestStreak: 7, house: 2, daysUsed: 30 });
    expect(nextBeat({ ...calm, seen: base, seenToday: false, facts: all })).toBe("ch3_new_friend");
    expect(nextBeat({ ...calm, seen: [...base, "ch3_new_friend"], seenToday: false, facts: all })).toBe(
      "ch4_sunset",
    );
    // Farmhouse 2 without a streak or a hatch: the move-in, then the café.
    const house = facts({ harvests: 9, goodDays: 9, house: 2 });
    expect(nextBeat({ ...calm, seen: base, seenToday: false, facts: house })).toBe("ch5_house");
    expect(nextBeat({ ...calm, seen: [...base, "ch5_house"], seenToday: false, facts: house })).toBe(
      "cafe_open",
    );
    expect(STORY.ch4_sunset.gift).toEqual({ decor: "farm_sign" });
    // G7 R2-2: in November, the Lotus opening (month-only) goes before queued chapters 3+…
    expect(nextBeat({ ...calm, seen: base, seenToday: false, facts: { ...all, today: "2026-11-03" } })).toBe(
      "lotus_open",
    );
    // …but never before the first-week chapters 0–2.
    expect(
      nextBeat({ ...calm, seen: ["ch0_gate"], seenToday: false, facts: { ...all, today: "2026-11-03" } }),
    ).toBe("ch1_first_harvest");
    expect(STORY.ch6_album.gift).toEqual({ tickets: 2 });
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

describe("seasonal beats (Candle Lotus, docs/STORY.md)", () => {
  const main = ["ch0_gate", "ch1_first_harvest", "ch2_watering_can"];
  const at = (today: string, seasonUses: string[] = []) => facts({ today, seasonUses });

  it("the opening plays from day 1 of November, after the main chapters, keyed by year", () => {
    expect(nextBeat({ ...calm, seen: main, seenToday: false, facts: at("2026-11-01") })).toBe("lotus_open");
    // The main chapters come first when both are ready.
    expect(nextBeat({ ...calm, seen: [], seenToday: false, facts: at("2026-11-01") })).toBe("ch0_gate");
    expect(beatKey("lotus_open", "2026-11-01")).toBe("lotus_open:2026");
    expect(beatKey("ch0_gate", "2026-11-01")).toBe("ch0_gate");
    // Seen this year → the market waits for day 15.
    const seen = [...main, "lotus_open:2026"];
    expect(nextBeat({ ...calm, seen, seenToday: false, facts: at("2026-11-14") })).toBeNull();
    expect(nextBeat({ ...calm, seen, seenToday: false, facts: at("2026-11-15") })).toBe("lotus_market");
    // Next year it's new again.
    expect(nextBeat({ ...calm, seen, seenToday: false, facts: at("2027-11-02") })).toBe("lotus_open");
  });

  it("outside November the Lotus opening and market wait for next year (the crop comes back too)", () => {
    // December has its own crop: its opening plays instead of the Lotus's.
    expect(nextBeat({ ...calm, seen: main, seenToday: false, facts: at("2026-12-01") })).toBe("snow_open");
    expect(
      nextBeat({ ...calm, seen: [...main, "snow_open:2026"], seenToday: false, facts: at("2026-12-01") }),
    ).toBeNull();
    expect(nextBeat({ ...calm, seen: main, seenToday: false, facts: at("2026-10-31") })).toBeNull();
    expect(nextBeat({ ...calm, seen: main, seenToday: false, facts: facts() })).toBeNull();
  });

  it("the use beat waits for the first sale or delivery this season-year; still one beat a day", () => {
    const seen = [...main, "lotus_open:2026", "lotus_market:2026"];
    expect(nextBeat({ ...calm, seen, seenToday: false, facts: at("2026-11-20") })).toBeNull();
    expect(
      nextBeat({ ...calm, seen, seenToday: false, facts: at("2026-11-20", ["candle_lotus:2026"]) }),
    ).toBe("lotus_use");
    expect(
      nextBeat({ ...calm, seen, seenToday: true, facts: at("2026-11-20", ["candle_lotus:2026"]) }),
    ).toBeNull();
    // Last year's sale doesn't count for this year; a January sale counts for last November.
    expect(
      nextBeat({ ...calm, seen, seenToday: false, facts: at("2026-11-20", ["candle_lotus:2025"]) }),
    ).toBeNull();
    expect(
      nextBeat({ ...calm, seen, seenToday: false, facts: at("2027-01-05", ["candle_lotus:2026"]) }),
    ).toBe("lotus_use");
    expect(
      nextBeat({
        ...calm,
        seen: [...seen, "lotus_use:2026"],
        seenToday: false,
        facts: at("2027-01-05", ["candle_lotus:2026"]),
      }),
    ).toBeNull();
  });

  it("seasonal triggers", () => {
    expect(triggerMet({ kind: "season", crop: "candle_lotus", from: 15 }, at("2026-11-15"))).toBe(true);
    expect(triggerMet({ kind: "season", crop: "candle_lotus", from: 15 }, at("2026-11-14"))).toBe(false);
    expect(triggerMet({ kind: "season_use", crop: "candle_lotus" }, at("2026-11-02"))).toBe(false);
  });

  it("the Candle Lotus beats: opening day 1, market day 15, the use beat floats a wish", () => {
    expect(STORY.lotus_open.trigger).toEqual({ kind: "season", crop: "candle_lotus", from: 1 });
    expect(STORY.lotus_market.trigger).toEqual({
      kind: "season",
      crop: "candle_lotus",
      from: PLANTING_DAYS + 1,
    });
    expect(STORY.lotus_use.trigger).toEqual({ kind: "season_use", crop: "candle_lotus" });
    expect(STORY.lotus_use.panels.filter((p) => p.form === "wish")).toHaveLength(1);
  });
});

describe("seasonal beats (Snow Strawberry, December)", () => {
  const main = ["ch0_gate", "ch1_first_harvest", "ch2_watering_can"];
  const at = (today: string, seasonUses: string[] = []) => facts({ today, seasonUses });
  it("opening Dec 1, market Dec 15, use after a sale; the use beat shows the year in review", () => {
    expect(nextBeat({ ...calm, seen: main, seenToday: false, facts: at("2026-12-03") })).toBe("snow_open");
    const seen = [...main, "snow_open:2026"];
    expect(nextBeat({ ...calm, seen, seenToday: false, facts: at("2026-12-14") })).toBeNull();
    expect(nextBeat({ ...calm, seen, seenToday: false, facts: at("2026-12-15") })).toBe("snow_market");
    expect(
      nextBeat({
        ...calm,
        seen: [...seen, "snow_market:2026"],
        seenToday: false,
        facts: at("2026-12-20", ["snow_strawberry:2026"]),
      }),
    ).toBe("snow_use");
    expect(STORY.snow_use.panels.filter((p) => p.form === "review")).toHaveLength(1);
  });
});
