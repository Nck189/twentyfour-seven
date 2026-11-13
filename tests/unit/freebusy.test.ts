import { describe, expect, it } from "vitest";
import { freeForDay, slotsText, subtract } from "@/lib/share/freebusy";

const TZ = "Asia/Bangkok";
const bkk = (h: number, m = 0, d = 12) => new Date(Date.UTC(2026, 10, d, h - 7, m));

describe("free/busy for share links (M12)", () => {
  it("free = the Free block minus fixed events, gaps under 30 min dropped", () => {
    const day = freeForDay({
      date: "2026-11-12",
      free: { start: bkk(17), end: bkk(21) },
      fixed: [
        { start: bkk(18), end: bkk(19) },
        { start: bkk(20, 40), end: bkk(21, 30) },
      ],
      now: bkk(9),
      tz: TZ,
    });
    expect(day.free.map((i) => [i.start.toISOString(), i.end.toISOString()])).toEqual([
      [bkk(17).toISOString(), bkk(18).toISOString()],
      [bkk(19).toISOString(), bkk(20, 40).toISOString()],
    ]);
  });

  it("starts from now; nothing after local midnight; no Free block → nothing", () => {
    const late = freeForDay({
      date: "2026-11-12",
      free: { start: bkk(22), end: bkk(1, 0, 13) },
      fixed: [],
      now: bkk(22, 30),
      tz: TZ,
    });
    expect(late.free.map((i) => [i.start.toISOString(), i.end.toISOString()])).toEqual([
      [bkk(22, 30).toISOString(), bkk(0, 0, 13).toISOString()],
    ]);
    expect(freeForDay({ date: "2026-11-12", free: null, fixed: [], now: bkk(9), tz: TZ }).free).toEqual([]);
    expect(
      freeForDay({
        date: "2026-11-12",
        free: { start: bkk(17), end: bkk(18) },
        fixed: [],
        now: bkk(17, 45),
        tz: TZ,
      }).free,
    ).toEqual([]);
  });

  it("subtract handles cuts at the edges and around", () => {
    const base = { start: bkk(10), end: bkk(12) };
    expect(subtract(base, [{ start: bkk(9), end: bkk(13) }])).toEqual([]);
    expect(subtract(base, [{ start: bkk(9), end: bkk(10) }])).toEqual([base]);
  });

  it("copy as text: one line per day with free times; a friendly line when none", () => {
    const fmt = {
      day: (d: string) => d,
      time: (d: Date) => d.toISOString().slice(11, 16),
      title: "Free times",
      none: "No free time in the next 2 weeks",
    };
    expect(
      slotsText(
        [
          { date: "2026-11-12", free: [{ start: bkk(17), end: bkk(18) }] },
          { date: "2026-11-13", free: [] },
        ],
        fmt,
      ),
    ).toBe("Free times\n2026-11-12: 10:00–11:00");
    expect(slotsText([], fmt)).toBe("Free times\nNo free time in the next 2 weeks");
  });
});
