import { describe, expect, it } from "vitest";
import { DEFAULT_BLOCKS } from "@/content/blocks";
import { DEFAULT_TEMPLATES } from "@/content/defaults";
import { COINS_BY_PRIORITY } from "@/content/economy";
import {
  NEAR_DEADLINE_DAYS,
  carryOver,
  dayCapacity,
  daysBetween,
  freeMinutes,
  sortBacklog,
  type BacklogItem,
} from "@/lib/backlog";
import { planDay, resolveDay } from "@/lib/engine";

const TZ = "Asia/Bangkok";
const tpl = (key: string) => DEFAULT_TEMPLATES.find((t) => t.key === key)!;
const plan = (date: string, key: string, nextWake = "10:00") =>
  planDay({ date, timezone: TZ, ...resolveDay(tpl(key), DEFAULT_BLOCKS), nextTargetWake: nextWake });

let seq = 0;
const item = (over: Partial<BacklogItem> = {}): BacklogItem => ({
  id: `i${++seq}`,
  title: `Item ${seq}`,
  tag: null,
  estimate_min: null,
  priority: "should",
  deadline: null,
  scheduled_date: null,
  block: null,
  status: "inbox",
  carry_count: 0,
  checklist: [],
  done_at: null,
  created_at: `2026-11-01T0${seq % 10}:00:00Z`,
  ...over,
});

describe("daysBetween", () => {
  it("counts calendar days, negative when overdue, across month ends", () => {
    expect(daysBetween("2026-11-02", "2026-11-05")).toBe(3);
    expect(daysBetween("2026-11-02", "2026-11-01")).toBe(-1);
    expect(daysBetween("2026-10-30", "2026-11-02")).toBe(3);
  });
});

describe("sortBacklog (SPEC §5: near-deadline items float to the top)", () => {
  it("near or overdue deadlines first (soonest first), then Must > Should > Just start, then oldest", () => {
    const today = "2026-11-02";
    const justStart = item({ priority: "just_start", created_at: "2026-10-01T00:00:00Z" });
    const mustOld = item({ priority: "must", created_at: "2026-10-02T00:00:00Z" });
    const mustNew = item({ priority: "must", created_at: "2026-10-20T00:00:00Z" });
    const should = item({ priority: "should" });
    const dueSoon = item({ priority: "just_start", deadline: "2026-11-04" }); // 2 days
    const overdue = item({ priority: "should", deadline: "2026-11-01" });
    const dueLater = item({ priority: "must", deadline: "2026-11-30" }); // far: ranked by priority
    const edge = item({ priority: "just_start", deadline: "2026-11-05" }); // exactly NEAR_DEADLINE_DAYS
    expect(NEAR_DEADLINE_DAYS).toBe(3);
    const sorted = sortBacklog(
      [justStart, should, dueLater, mustNew, dueSoon, mustOld, edge, overdue],
      today,
    );
    expect(sorted.map((i) => i.id)).toEqual([
      overdue.id,
      dueSoon.id,
      edge.id,
      dueLater.id, // must + a deadline beats must without one
      mustOld.id,
      mustNew.id,
      should.id,
      justStart.id,
    ]);
  });

  it("does not mutate its input", () => {
    const list = [item({ priority: "just_start" }), item({ priority: "must" })];
    const copy = [...list];
    sortBacklog(list, "2026-11-02");
    expect(list).toEqual(copy);
  });
});

describe("capacity bar (RCCP: estimates vs free minutes in the target blocks)", () => {
  it("free day: Work has its full 9 h free", () => {
    const p = plan("2026-11-02", "free_weekday");
    expect(freeMinutes(p, "work")).toBe(540);
  });

  it("Wed class day: the class eats Work time — hand calculation", () => {
    // Work 09:00–18:00 = 540 min; class 09:00–16:00 = 420 min → 120 min free.
    const p = plan("2026-11-04", "class_wed", "07:30");
    expect(freeMinutes(p, "work")).toBe(120);
    const day = dayCapacity(p, [
      item({ scheduled_date: "2026-11-04", status: "scheduled", estimate_min: 60 }),
      item({ scheduled_date: "2026-11-04", status: "scheduled", estimate_min: 90, block: "work" }),
    ]);
    expect(day).toEqual({ capacityMin: 120, loadMin: 150, overloaded: true, unestimated: 0 });
  });

  it("items in another block add that block's free time; dropped items don't count; no estimate is flagged", () => {
    const p = plan("2026-11-02", "free_weekday");
    const day = dayCapacity(p, [
      item({ status: "scheduled", estimate_min: 30, block: "focus" }),
      item({ status: "scheduled", estimate_min: 200 }),
      item({ status: "scheduled" }),
      item({ status: "dropped", estimate_min: 999 }),
      item({ status: "done", estimate_min: 20 }),
    ]);
    // Work 540 + Focus 90 free; load 30 + 200 + 20 (done items used that time too).
    expect(day).toEqual({ capacityMin: 630, loadMin: 250, overloaded: false, unestimated: 1 });
  });

  it("exactly full is not overloaded", () => {
    const p = plan("2026-11-02", "free_weekday");
    expect(dayCapacity(p, [item({ status: "scheduled", estimate_min: 540 })]).overloaded).toBe(false);
    expect(dayCapacity(p, [item({ status: "scheduled", estimate_min: 541 })]).overloaded).toBe(true);
  });
});

describe("carry-over (Night ritual)", () => {
  it("moves an unfinished item to another day and counts the carry", () => {
    const i = item({ status: "scheduled", scheduled_date: "2026-11-02", block: "focus", carry_count: 1 });
    expect(carryOver(i, "2026-11-03")).toEqual({
      scheduled_date: "2026-11-03",
      block: "focus",
      status: "scheduled",
      carry_count: 2,
    });
  });

  it("back to the inbox also counts as a carry; Work is the default block", () => {
    const i = item({ status: "scheduled", scheduled_date: "2026-11-02" });
    expect(carryOver(i, null)).toEqual({
      scheduled_date: null,
      block: null,
      status: "inbox",
      carry_count: 1,
    });
    expect(carryOver(i, "2026-11-04").block).toBe("work");
  });
});

describe("coins on completion (Must > Should > Just start)", () => {
  it("is strictly ordered and positive", () => {
    expect(COINS_BY_PRIORITY.must).toBeGreaterThan(COINS_BY_PRIORITY.should);
    expect(COINS_BY_PRIORITY.should).toBeGreaterThan(COINS_BY_PRIORITY.just_start);
    expect(COINS_BY_PRIORITY.just_start).toBeGreaterThan(0);
  });
});
