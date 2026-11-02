import { describe, expect, it } from "vitest";
import {
  NONE,
  bedtimeFor,
  first10Options,
  isSuggestion,
  needsOnboarding,
  sleepMinutes,
  suggestionToken,
} from "@/lib/onboarding";

describe("sleep targets from bed + wake times", () => {
  it("crosses midnight", () => {
    expect(sleepMinutes("02:30", "10:00")).toBe(450);
    expect(sleepMinutes("23:00", "07:00")).toBe(480);
    expect(sleepMinutes("00:00", "07:30")).toBe(450);
  });
  it("same time means 24 h is impossible → null; outside 3–12 h → null", () => {
    expect(sleepMinutes("07:00", "07:00")).toBeNull();
    expect(sleepMinutes("06:00", "07:00")).toBeNull(); // 1 h
    expect(sleepMinutes("18:00", "07:00")).toBeNull(); // 13 h
  });
  it("bedtime back from wake and sleep length", () => {
    expect(bedtimeFor("10:00", 450)).toBe("02:30");
    expect(bedtimeFor("07:30", 450)).toBe("00:00");
    expect(bedtimeFor("07:00", 480)).toBe("23:00");
  });
});

describe("onboarding state", () => {
  it("shows the welcome until done or skipped", () => {
    expect(needsOnboarding({})).toBe(true);
    expect(needsOnboarding(null)).toBe(true);
    expect(needsOnboarding({ done: true })).toBe(false);
    expect(needsOnboarding({ skipped: true })).toBe(false);
  });
});

describe("first-10 choices per block", () => {
  it("built-in default (null) + suggestions + the user's own, deduped, own last", () => {
    expect(first10Options("work", ["Plan with coffee", "Plan with coffee"])).toEqual([
      null,
      suggestionToken("work", 1),
      suggestionToken("work", 2),
      "Plan with coffee",
    ]);
  });
  it("blocks without a built-in default get three suggestions", () => {
    expect(first10Options("focus", [])).toEqual([
      suggestionToken("focus", 1),
      suggestionToken("focus", 2),
      suggestionToken("focus", 3),
    ]);
  });
  it("tokens are recognisable and NONE means 'no first-10'", () => {
    expect(isSuggestion(suggestionToken("free", 2))).toBe(true);
    expect(isSuggestion("Read")).toBe(false);
    expect(NONE).toBe("");
  });
});
