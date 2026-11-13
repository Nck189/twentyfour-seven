import { describe, expect, it } from "vitest";
import {
  askAfterOrder,
  askAtBedtime,
  cardProgress,
  coffeeDay,
  coffeeSleep,
  laterSlot,
  slotOf,
} from "@/lib/game/cafe";

describe("Som's café (docs/STORY.md, Minnie's popup flow)", () => {
  it("a stamp card fills at 10, then starts again; stamps never expire", () => {
    expect(cardProgress(0)).toEqual({ cards: 0, onCard: 0 });
    expect(cardProgress(9)).toEqual({ cards: 0, onCard: 9 });
    expect(cardProgress(10)).toEqual({ cards: 1, onCard: 0 });
    expect(cardProgress(23)).toEqual({ cards: 2, onCard: 3 });
  });

  it("asks 'in real life too?' right after a coffee/tea order at most once a day, never when turned off", () => {
    expect(askAfterOrder({ answeredToday: null, gameOnly: false, drink: "latte" })).toBe(true);
    expect(askAfterOrder({ answeredToday: null, gameOnly: false, drink: "thai_tea" })).toBe(true);
    // G7 R-C4: water and cocoa never ask (a "yes" after water isn't a coffee day).
    expect(askAfterOrder({ answeredToday: null, gameOnly: false, drink: "water" })).toBe(false);
    expect(askAfterOrder({ answeredToday: null, gameOnly: false, drink: "cocoa" })).toBe(false);
    expect(askAfterOrder({ answeredToday: "later", gameOnly: false, drink: "latte" })).toBe(false);
    expect(askAfterOrder({ answeredToday: "yes", gameOnly: false, drink: "latte" })).toBe(false);
    expect(askAfterOrder({ answeredToday: null, gameOnly: true, drink: "latte" })).toBe(false);
  });

  it("the bedtime question comes after 'later' or an unanswered question; never after yes/just playing", () => {
    const at = (
      answeredToday: "yes" | "later" | "play" | null,
      o: Partial<{ night: boolean; off: boolean; ordered: boolean }> = {},
    ) =>
      askAtBedtime({
        answeredToday,
        nightAnswered: o.night ?? false,
        gameOnly: o.off ?? false,
        orderedToday: o.ordered ?? true,
      });
    expect(at("later")).toBe(true);
    expect(at("later", { night: true })).toBe(false);
    expect(at("yes")).toBe(false);
    expect(at("play")).toBe(false);
    // G7 R-C6: left without an answer (tab switch, app closed) → asked once at bedtime.
    expect(at(null)).toBe(true);
    expect(at(null, { ordered: false })).toBe(false);
    expect(at("later", { off: true })).toBe(false);
  });

  it("another real cup keeps the day's latest time of day (G7 R-C5)", () => {
    expect(laterSlot("morning", "afternoon")).toBe("afternoon");
    expect(laterSlot("evening", "morning")).toBe("evening");
    expect(laterSlot(null, "morning")).toBe("morning");
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

describe("coffee → bedtime insight (docs/STORY.md)", () => {
  const days = (n: number, start: number) =>
    Array.from({ length: n }, (_, i) => `2026-10-${String(start + i).padStart(2, "0")}`);
  it("hidden with no answers; counts answered days with a Goodnight until 8 on each side", () => {
    expect(coffeeSleep([], new Map())).toBeNull();
    expect(coffeeSleep([{ day: "2026-10-01", answer: "play", slot: null }], new Map())).toBeNull();
    const rows = [
      { day: "2026-10-01", answer: "yes" as const, slot: "afternoon" as const },
      { day: "2026-10-02", answer: "later" as const, slot: "none" as const },
      { day: "2026-10-03", answer: "later" as const, slot: "evening" as const }, // no Goodnight: left out
      { day: "2026-10-04", answer: "later" as const, slot: null }, // never answered at bedtime: left out
    ];
    const beds = new Map([
      ["2026-10-01", 600],
      ["2026-10-02", 570],
      ["2026-10-04", 560],
    ]);
    expect(coffeeSleep(rows, beds)).toEqual({ ready: false, late: 1, other: 1 });
  });
  it("with 8+ days each side: the mean Goodnight difference, rounded to 5 min", () => {
    const late = days(9, 1).map((day) => ({ day, answer: "yes" as const, slot: "evening" as const }));
    const other = days(11, 10).map((day, i) => ({
      day,
      answer: "later" as const,
      slot: i % 2 ? ("none" as const) : ("morning" as const),
    }));
    const beds = new Map<string, number>([
      ...late.map((r) => [r.day, 11 * 60 + 5] as [string, number]), // 23:05
      ...other.map((r) => [r.day, 10 * 60 + 30] as [string, number]), // 22:30
    ]);
    expect(coffeeSleep([...late, ...other], beds)).toEqual({ ready: true, late: 9, other: 11, diff: 35 });
  });
});
