import { describe, expect, it } from "vitest";
import {
  BLOCK_KEYS,
  isTracked,
  trackedOn,
  untrackedBlocks,
  untrackedOn,
  type BlockKey,
} from "@/content/blocks";
import { blockResult, buildDayFacts, dayOee, simulatePlot, type DayFacts, type GameLog } from "@/lib/game";

/** Rule B (Minnie OK 2026-11-27): choose which optional blocks to track. */
const T = (hm: string) => new Date(`2026-11-20T${hm}:00+07:00`).toISOString();
const good: GameLog = {
  planned_start: T("09:00"),
  started_at: T("09:05"),
  first10_at: T("09:12"),
  items_done: [],
  items_planned: 0,
  location: "home",
  backfilled: false,
  planned_deviation: false,
  miss_reason: null,
};
const day = (untracked: BlockKey[] = []): DayFacts => ({
  date: "2026-11-20",
  mode: "normal",
  logs: { wake: good, down: good, sleep: good, work: good },
  wakeInWindow: true,
  nightRitualDone: true,
  exercised: false,
  ...(untracked.length ? { untracked } : {}),
});

describe("tracked blocks (rule B)", () => {
  it("Wake, Down Time and Sleep are always tracked; no log means tracked; a dated log decides each day", () => {
    const off = (from: string) => [{ from, tracked: false }];
    const blocks = BLOCK_KEYS.map((key) => ({ key, tracked_log: off("2026-11-20") }));
    expect(untrackedBlocks(blocks)).toEqual(["focus", "work", "gradation", "free"]);
    expect(isTracked(blocks, "wake")).toBe(true);
    expect(untrackedBlocks([{ key: "focus" }, { key: "free" }])).toEqual([]);
    // Dated: before the change, tracked; from it, not; a later change back wins from its day.
    const focus = [
      { key: "focus" as const, tracked_log: [...off("2026-11-20"), { from: "2026-11-25", tracked: true }] },
    ];
    expect(trackedOn(focus, "focus", "2026-11-19")).toBe(true);
    expect(trackedOn(focus, "focus", "2026-11-20")).toBe(false);
    expect(trackedOn(focus, "focus", "2026-11-24")).toBe(false);
    expect(trackedOn(focus, "focus", "2026-11-25")).toBe(true);
    expect(isTracked(focus, "focus")).toBe(true);
    expect(untrackedOn(focus, "2026-11-22")).toEqual(["focus"]);
  });
  it("buildDayFacts reads the dated setting per day, so a later change never rewrites the past", () => {
    const settings = [{ key: "focus" as const, tracked_log: [{ from: "2026-11-21", tracked: false }] }];
    const days = buildDayFacts({
      from: "2026-11-20",
      today: "2026-11-22",
      timezone: "Asia/Bangkok",
      logs: [],
      modes: {},
      wakes: [],
      nights: [],
      exercise: [],
      blockSettings: settings,
    });
    expect(days.map((d) => d.untracked ?? [])).toEqual([[], ["focus"], ["focus"]]);
  });
  it("untracked blocks leave the Day score: tracking only what you do can reach a perfect score", () => {
    expect(dayOee(day())!.oee).toBeCloseTo(((4 / 7) * 4) / 7, 5);
    expect(dayOee(day(["focus", "gradation", "free"]))!.oee).toBe(1);
  });
  it("an untracked block with no check-in is excused, not missed; a check-in there still counts", () => {
    const d = day(["focus", "work"]);
    expect(blockResult(d, "focus")).toBe("excused");
    expect(blockResult(d, "work")).toBe("success");
    expect(blockResult(day(), "focus")).toBe("miss");
  });
  it("an untracked block's plot grows on every kept day, at normal quality; a quiet or missed day doesn't grow it", () => {
    const plant = { slot: "focus" as const, cropId: "sunflower" as const, star: 1, plantedOn: "2026-11-09" };
    const kept = (date: string): DayFacts => ({ ...day(["focus"]), date, logs: {}, nightRitualDone: false });
    const quiet = (date: string): DayFacts => ({ ...kept(date), wakeInWindow: false });
    const v = simulatePlot(plant, [kept("2026-11-10"), quiet("2026-11-11"), kept("2026-11-12")]);
    expect(v).toMatchObject({ growthDays: 2, status: "growing", weeds: false });
    const ripe = simulatePlot(plant, [kept("2026-11-10"), kept("2026-11-11"), kept("2026-11-12")]);
    expect(ripe).toMatchObject({ status: "ready", quality: "normal" });
    // Tracked, the same days grow nothing (no Focus check-in).
    expect(simulatePlot(plant, [{ ...kept("2026-11-10"), untracked: undefined }]).growthDays).toBe(0);
  });
});
