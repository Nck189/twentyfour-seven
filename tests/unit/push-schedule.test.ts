import { describe, expect, it } from "vitest";
import { DEFAULT_PUSH_PREFS, inQuietHours, planPushes, type PushBlock } from "@/lib/push/schedule";

const TZ = "Asia/Bangkok";
/** Bangkok wall time on 12 Nov 2026 (UTC+7). */
const bkk = (h: number, m = 0, d = 12) => new Date(Date.UTC(2026, 10, d, h - 7, m));
const blocks: PushBlock[] = [
  { key: "wake", start: bkk(7), end: bkk(8), first10: null },
  { key: "focus", start: bkk(8), end: bkk(9, 30), first10: "Open the thesis doc" },
  { key: "work", start: bkk(9, 30), end: bkk(18), first10: null },
  { key: "free", start: bkk(18), end: bkk(21), first10: null },
  { key: "down", start: bkk(21), end: bkk(22, 30), first10: null },
  { key: "sleep", start: bkk(22, 30), end: bkk(7, 0, 13), first10: null },
];
const plan = (now: Date, prefs = DEFAULT_PUSH_PREFS) =>
  planPushes({ day: "2026-11-12", nextDay: "2026-11-13", blocks, prefs, tz: TZ, now });

describe("push schedule (M11, SPEC §9)", () => {
  it("block starts (not Wake/Sleep), a first-10 nudge, the Night ritual at Down, tomorrow's 'I'm up'", () => {
    expect(plan(bkk(6)).map((p) => [p.kind, p.ref, p.fireAt.toISOString()])).toEqual([
      ["wake", "wake:2026-11-12", bkk(7, 10).toISOString()],
      ["block_start", "block_start:2026-11-12:focus", bkk(8).toISOString()],
      ["first10", "first10:2026-11-12:focus", bkk(8, 10).toISOString()],
      ["block_start", "block_start:2026-11-12:work", bkk(9, 30).toISOString()],
      ["block_start", "block_start:2026-11-12:free", bkk(18).toISOString()],
      ["night", "night:2026-11-12", bkk(21).toISOString()],
      ["wake", "wake:2026-11-13", bkk(7, 10, 13).toISOString()],
    ]);
  });

  it("only future ones; turned-off kinds are left out", () => {
    expect(plan(bkk(20)).map((p) => p.kind)).toEqual(["night", "wake"]);
    expect(
      plan(bkk(6), { ...DEFAULT_PUSH_PREFS, block_start: false, first10: false }).map((p) => p.kind),
    ).toEqual(["wake", "night", "wake"]);
  });

  it("quiet hours (may wrap midnight) drop pushes inside them", () => {
    const q = { quietStart: "20:30", quietEnd: "07:30" };
    expect(inQuietHours(bkk(21), q, TZ)).toBe(true);
    expect(inQuietHours(bkk(7, 10, 13), q, TZ)).toBe(true);
    expect(inQuietHours(bkk(7, 30, 13), q, TZ)).toBe(false);
    expect(inQuietHours(bkk(12), { quietStart: "12:00", quietEnd: "13:00" }, TZ)).toBe(true);
    expect(inQuietHours(bkk(12), { quietStart: null, quietEnd: "13:00" }, TZ)).toBe(false);
    expect(plan(bkk(6), { ...DEFAULT_PUSH_PREFS, ...q }).map((p) => p.kind)).toEqual([
      "block_start",
      "first10",
      "block_start",
      "block_start",
    ]);
  });

  it("G7 R-M11-2: re-planned after the wake target (Today flips there), today's 'I'm up' reminder stays", () => {
    // 07:05: the wake target passed, "I'm up" not pressed; the reminder at 07:10 must still be planned.
    const refs = plan(bkk(7, 5)).map((p) => p.ref);
    expect(refs).toContain("wake:2026-11-12");
    expect(refs).toContain("wake:2026-11-13");
    // Once it's past, it isn't planned again.
    expect(plan(bkk(7, 15)).map((p) => p.ref)).not.toContain("wake:2026-11-12");
  });

  it("G7 R-M11-8: Vacation/Sick days get no block nudges (wake and Night ritual still follow the plan)", () => {
    const kinds = planPushes({
      day: "2026-11-12",
      nextDay: "2026-11-13",
      blocks,
      prefs: DEFAULT_PUSH_PREFS,
      tz: TZ,
      now: bkk(6),
      mode: "vacation",
    }).map((p) => p.kind);
    expect(kinds).not.toContain("block_start");
    expect(kinds).not.toContain("first10");
  });

  it("no first-10 nudge when the block is shorter than the nudge delay", () => {
    const short: PushBlock[] = [{ key: "gradation", start: bkk(10), end: bkk(10, 5), first10: "Stretch" }];
    expect(
      planPushes({
        day: "2026-11-12",
        nextDay: "2026-11-13",
        blocks: short,
        prefs: DEFAULT_PUSH_PREFS,
        tz: TZ,
        now: bkk(6),
      }).map((p) => p.kind),
    ).toEqual(["block_start"]);
  });
});
