import { describe, expect, it } from "vitest";
import type { BlockKey } from "@/content/blocks";
import type { DayFacts, GameLog } from "@/lib/game";
import {
  heatmap,
  homeVsOut,
  imrChart,
  pareto,
  sleepRegularity,
  splitWeekend,
  weekSummary,
} from "@/lib/stats/stats";

const at = (d: string, hm: string) => new Date(`${d}T${hm}:00+07:00`).toISOString();
const log = (d: string, o: Partial<GameLog> = {}): GameLog => ({
  planned_start: at(d, "09:00"),
  started_at: at(d, "09:03"),
  first10_at: at(d, "09:10"),
  items_done: [],
  items_planned: 0,
  location: "home",
  backfilled: false,
  planned_deviation: false,
  miss_reason: null,
  ...o,
});
const day = (
  date: string,
  logs: Partial<Record<BlockKey, GameLog>>,
  o: Partial<DayFacts> = {},
): DayFacts => ({
  date,
  mode: "normal",
  logs,
  wakeInWindow: true,
  nightRitualDone: true,
  exercised: false,
  ...o,
});

describe("I-MR chart (SPEC §7 wake times)", () => {
  it("mean, MR̄, σ = MR̄/1.128 and ±3σ limits; flags the point outside", () => {
    // Steady around 07:00 (420), one late wake at 10:30 (630).
    const values = [420, 425, 418, 422, 420, 424, 630, 421, 419, 423];
    const c = imrChart(
      values.map((v, i) => ({ date: `2026-11-${String(i + 1).padStart(2, "0")}`, value: v })),
    )!;
    expect(c.mean).toBeCloseTo(442.2, 1);
    const mrs = values.slice(1).map((v, i) => Math.abs(v - values[i]!));
    expect(c.mrBar).toBeCloseTo(mrs.reduce((a, b) => a + b) / mrs.length, 6);
    expect(c.sigma).toBeCloseTo(c.mrBar / 1.128, 6);
    expect(c.ucl).toBeCloseTo(c.mean + 3 * c.sigma, 6);
    expect(c.points[0]!.mr).toBeNull();
    // The 10:30 wake is far outside mean + 3σ: flagged.
    expect(c.points.filter((p) => p.out).map((p) => p.value)).toEqual([630]);
  });
  it("a tight process flags a clear outlier; one point is not a chart", () => {
    const values = [420, 421, 420, 421, 420, 421, 420, 421, 420, 480];
    const c = imrChart(values.map((v, i) => ({ date: `d${i}`, value: v })))!;
    expect(c.points.at(-1)!.out).toBe(true);
    expect(imrChart([{ date: "x", value: 1 }])).toBeNull();
  });
  it("splits weekdays from the weekend", () => {
    // 2026-11-07 is a Saturday, 2026-11-09 a Monday.
    const s = splitWeekend([
      { date: "2026-11-07", value: 1 },
      { date: "2026-11-08", value: 2 },
      { date: "2026-11-09", value: 3 },
    ]);
    expect(s.weekend.map((p) => p.value)).toEqual([1, 2]);
    expect(s.weekday.map((p) => p.value)).toEqual([3]);
  });
});

describe("sleep regularity", () => {
  it("SD over the last 7 days with data, and the wake drift per day", () => {
    const days = Array.from({ length: 9 }, (_, i) => ({
      date: `d${i}`,
      bed: 660 + (i % 2) * 60, // 23:00 / 00:00 alternating
      wake: 420 + i * 5, // 5 min later every day
    }));
    const r = sleepRegularity(days);
    expect(r.wakeDrift).toBeCloseTo(5, 6);
    expect(r.bedSd).toBeGreaterThan(25);
    expect(r.wakeSd).toBeCloseTo(Math.sqrt(((25 * 28) / 6) * 1), 0);
    expect(sleepRegularity([{ date: "a", bed: null, wake: 400 }])).toEqual({
      bedSd: null,
      wakeSd: null,
      wakeDrift: null,
    });
  });
});

describe("heatmap, Pareto, home vs out, week summary", () => {
  const mon = "2026-11-09";
  const tue = "2026-11-10";
  const days = [
    day(mon, {
      focus: log(mon),
      work: log(mon, { started_at: null, first10_at: null, miss_reason: "phone" }),
      free: log(mon, { location: "out", started_at: at(mon, "10:00") }), // late, no checklist → partial
    }),
    day(tue, {
      focus: log(tue, { location: "out" }),
      work: log(tue, { started_at: null, first10_at: null, miss_reason: "phone" }),
      gradation: log(tue, { started_at: null, first10_at: null, miss_reason: "sleepy" }),
      free: log(tue, { planned_deviation: true }),
    }),
    day("2026-11-11", { focus: log("2026-11-11") }, { mode: "sick" }),
  ];

  it("heatmap counts success over judged blocks by weekday (excused days left out)", () => {
    const h = heatmap(days);
    expect(h.focus[1]).toEqual({ success: 1, judged: 1 });
    expect(h.work[1]).toEqual({ success: 0, judged: 1 });
    expect(h.free[1]).toEqual({ success: 0, judged: 1 });
    expect(h.free[2]).toEqual({ success: 0, judged: 0 }); // planned deviation
    expect(h.focus[3]).toEqual({ success: 0, judged: 0 }); // sick day
  });
  it("Pareto sorts miss reasons with shares and the running total", () => {
    expect(pareto(days)).toEqual([
      { reason: "phone", count: 2, share: 2 / 3, cumulative: 2 / 3 },
      { reason: "sleepy", count: 1, share: 1 / 3, cumulative: 1 },
    ]);
  });
  it("home vs out compares done / checked in", () => {
    const r = homeVsOut(days);
    expect(r.home).toEqual({ done: 1, logged: 4, rate: 0.25 });
    expect(r.out).toEqual({ done: 2, logged: 2, rate: 1 });
  });
  it("week summary: OEE mean, minimum/perfect days, best/worst block", () => {
    const w = weekSummary(days);
    expect(w.days).toBe(3);
    expect(w.minimumDays).toBe(3);
    expect(w.avgOee).not.toBeNull();
    expect(w.bestBlock).toBe("focus");
    // Ties go to the earlier block of the day (Down Time was never checked in: 0 of 2).
    expect(w.worstBlock).toBe("down");
  });
});
