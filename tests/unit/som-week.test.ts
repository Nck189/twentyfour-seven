import { describe, expect, it } from "vitest";
import { somWeek } from "@/lib/game/somLines";

const week = (minimumDays: number, perfectDays = 0, days = 7) => ({
  days,
  avgOee: null,
  minimumDays,
  perfectDays,
  bestBlock: null,
  worstBlock: null,
});

describe("Sunday with Som (docs/STORY.md): a kind reaction to the week, never a scolding", () => {
  it("proud at 5+ counted days, with the number", () => {
    expect(somWeek(week(5))).toEqual({ mood: "proud", pose: "happy", n: 5 });
    expect(somWeek(week(7, 3))).toEqual({ mood: "proud", pose: "happy", n: 7 });
  });
  it("warm for some counted days", () => {
    expect(somWeek(week(2))).toEqual({ mood: "good", pose: "sit", n: 2 });
  });
  it("gentle for a hard week (no counted days)", () => {
    expect(somWeek(week(0))).toEqual({ mood: "gentle", pose: "lookUp", n: 0 });
  });
  it("a perfect day makes it proud even in a short week", () => {
    expect(somWeek(week(2, 1, 3))).toEqual({ mood: "proud", pose: "happy", n: 2 });
  });
});
