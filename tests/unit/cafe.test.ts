import { describe, expect, it } from "vitest";
import { askAfterOrder, askAtBedtime, cardProgress, coffeeDay, slotOf } from "@/lib/game/cafe";

describe("Som's café (docs/STORY.md, Minnie's popup flow)", () => {
  it("a stamp card fills at 10, then starts again; stamps never expire", () => {
    expect(cardProgress(0)).toEqual({ cards: 0, onCard: 0 });
    expect(cardProgress(9)).toEqual({ cards: 0, onCard: 9 });
    expect(cardProgress(10)).toEqual({ cards: 1, onCard: 0 });
    expect(cardProgress(23)).toEqual({ cards: 2, onCard: 3 });
  });

  it("asks 'in real life too?' right after an order at most once a day, never when turned off", () => {
    expect(askAfterOrder({ answeredToday: null, gameOnly: false })).toBe(true);
    expect(askAfterOrder({ answeredToday: "later", gameOnly: false })).toBe(false);
    expect(askAfterOrder({ answeredToday: "yes", gameOnly: false })).toBe(false);
    expect(askAfterOrder({ answeredToday: null, gameOnly: true })).toBe(false);
  });

  it("the bedtime question comes only after 'later' (or a closed popup); never after yes/just playing", () => {
    expect(askAtBedtime({ answeredToday: "later", nightAnswered: false, gameOnly: false })).toBe(true);
    expect(askAtBedtime({ answeredToday: "later", nightAnswered: true, gameOnly: false })).toBe(false);
    expect(askAtBedtime({ answeredToday: "yes", nightAnswered: false, gameOnly: false })).toBe(false);
    expect(askAtBedtime({ answeredToday: "play", nightAnswered: false, gameOnly: false })).toBe(false);
    expect(askAtBedtime({ answeredToday: null, nightAnswered: false, gameOnly: false })).toBe(false);
    expect(askAtBedtime({ answeredToday: "later", nightAnswered: false, gameOnly: true })).toBe(false);
  });

  it("a real coffee's time of day: morning before noon, afternoon until 17:00, then evening", () => {
    expect(slotOf(new Date(2026, 10, 12, 8))).toBe("morning");
    expect(slotOf(new Date(2026, 10, 12, 12))).toBe("afternoon");
    expect(slotOf(new Date(2026, 10, 12, 16, 59))).toBe("afternoon");
    expect(slotOf(new Date(2026, 10, 12, 17))).toBe("evening");
  });

  it("a day counts for the insight only when answered: yes / a bedtime slot, or 'none'; play or nothing is left out", () => {
    expect(coffeeDay({ answer: "yes", slot: "afternoon" })).toBe("afternoon");
    expect(coffeeDay({ answer: "later", slot: "none" })).toBe("none");
    expect(coffeeDay({ answer: "later", slot: null })).toBeNull();
    expect(coffeeDay({ answer: "play", slot: null })).toBeNull();
  });
});
