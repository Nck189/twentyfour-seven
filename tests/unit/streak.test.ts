import { describe, expect, it } from "vitest";
import { BLOCK_KEYS, type BlockKey } from "@/content/blocks";
import type { DayFacts, GameLog } from "@/lib/game";
import { dayKind, settleStreak } from "@/lib/game/streak";
import { addDays } from "@/lib/time";

const START = "2026-11-01";
const at = (d: string, hm: string) => new Date(`${d}T${hm}:00+07:00`).toISOString();
const goodLog = (d: string): GameLog => ({
  planned_start: at(d, "09:00"),
  started_at: at(d, "09:03"),
  first10_at: at(d, "09:10"),
  items_done: [],
  items_planned: 0,
  location: "home",
  backfilled: false,
  planned_deviation: false,
  miss_reason: null,
});

type Opt = { wake?: boolean; night?: boolean; mode?: DayFacts["mode"]; perfect?: boolean; lateNight?: boolean };
function day(i: number, o: Opt = {}): DayFacts {
  const date = addDays(START, i);
  const logs: Partial<Record<BlockKey, GameLog>> = {};
  if (o.perfect) for (const b of BLOCK_KEYS) logs[b] = goodLog(date);
  return {
    date,
    mode: o.mode ?? "normal",
    logs,
    wakeInWindow: o.wake ?? true,
    nightRitualDone: o.night ?? true,
    exercised: false,
    ...(o.lateNight ? { excused: ["free" as BlockKey] } : {}),
  };
}

describe("dayKind", () => {
  it("vacation/sick pause; a planned late night stands in for the ritual; no wake = not a minimum day", () => {
    expect(dayKind(day(0, { mode: "vacation", wake: false }), 0)).toBe("paused");
    expect(dayKind(day(0, { night: false, lateNight: true }), 0)).toBe("minimum");
    expect(dayKind(day(0, { night: false }), 0)).toBe("missed");
    expect(dayKind(day(0, { wake: false }), 1)).toBe("frozen");
    expect(dayKind(day(0, { perfect: true }), 0)).toBe("perfect");
  });
});

describe("settleStreak over a simulated month (BUILD_PLAN M9 'done when')", () => {
  it("misses, scarecrows, vacation, a planned late night, milestones and a perfect day", () => {
    const days: DayFacts[] = [];
    for (let i = 0; i < 7; i++) days.push(day(i)); // 1–7: streak 7 → scarecrow, +5
    days.push(day(7, { wake: false })); // 8: missed → scarecrow used
    days.push(day(8, { mode: "vacation", wake: false, night: false }), day(9, { mode: "sick", wake: false }));
    days.push(day(10, { night: false, lateNight: true })); // 11: planned late night still counts
    days.push(day(11, { night: false })); // 12: missed, no scarecrow → 0
    for (let i = 12; i < 26; i++) days.push(day(i)); // 13–26: 14 days → scarecrows at 7 and 14
    days.push(day(26, { perfect: true })); // 27: perfect → +1
    days.push(day(27, { wake: false }), day(28, { wake: false })); // 28–29: two scarecrows used
    days.push(day(29, { wake: false })); // 30: missed → 0

    const r = settleStreak(days);
    expect(r.days.map((d) => d.kind)).toEqual([
      ...Array(7).fill("minimum"),
      "frozen",
      "paused",
      "paused",
      "minimum",
      "missed",
      ...Array(14).fill("minimum"),
      "perfect",
      "frozen",
      "frozen",
      "missed",
    ]);
    expect(r.state).toEqual({ streak: 0, best: 15, freezes: 0 });
    expect(r.grants).toEqual([
      { reason: "streak_7", date: addDays(START, 6), amount: 5 },
      { reason: "streak_7", date: addDays(START, 18), amount: 5 },
      { reason: "streak_14", date: addDays(START, 25), amount: 5 },
      { reason: "perfect_day", date: addDays(START, 26), amount: 1 },
    ]);
  });

  it("holds at most 2 scarecrows; a 30-day streak pays the 30 milestone; picks up from a saved state", () => {
    const days = Array.from({ length: 30 }, (_, i) => day(i));
    const r = settleStreak(days);
    expect(r.state).toEqual({ streak: 30, best: 30, freezes: 2 });
    expect(r.grants.map((g) => g.reason)).toEqual(["streak_7", "streak_14", "streak_30"]);
    // Continuing from a saved state gives the same result as one pass.
    const a = settleStreak(days.slice(0, 10));
    const b = settleStreak(days.slice(10), a.state);
    expect(b.state).toEqual(r.state);
    expect([...a.grants, ...b.grants]).toEqual(r.grants);
  });
});
