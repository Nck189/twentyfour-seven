import { describe, expect, it } from "vitest";
import { markDirty, requeue } from "@/lib/plan/patch";
import type { DayPlanRow } from "@/lib/today/day";

const row = (over: Partial<DayPlanRow> = {}): DayPlanRow => ({
  date: "2026-11-04",
  template_id: null,
  attending: null,
  bedtime_override: null,
  late_night: null,
  mode: "normal",
  overrides: {},
  ...over,
});

describe("day-plan saves carry only what changed (R-M3-4)", () => {
  it("a bedtime push sends the bedtime, not the mode or other blocks", () => {
    const d = markDirty(undefined, { bedtime_override: "2026-11-03T20:00:00Z" }, row({ mode: "sick" }));
    expect(d).toEqual({
      set: { bedtime_override: "2026-11-03T20:00:00Z" },
      blocks: undefined,
      fixedEvents: undefined,
    });
  });

  it("a block edit sends that block's whole override only", () => {
    const r = row({
      overrides: {
        blocks: { focus: { first10: "Open notes" }, work: { checklist: [{ id: "a", label: "A" }] } },
      },
    });
    const d = markDirty(undefined, { block: { key: "focus" } }, r);
    expect(d.blocks).toEqual({ focus: { first10: "Open notes" } });
    expect(d.set).toEqual({});
  });

  it("edits pile up; a failed save is requeued under newer edits (newer wins)", () => {
    const a = markDirty(undefined, { bedtime_override: "A", mode: "normal" }, row());
    const b = markDirty(undefined, { bedtime_override: "B" }, row());
    expect(requeue(a, b).set).toEqual({ bedtime_override: "B", mode: "normal" });
    expect(requeue(a, undefined)).toEqual(a);
  });

  it("appointments go one by one; removing an unsaved one just cancels it (R2-5)", () => {
    const a = { id: "a", key: "appointment", title: "Dentist", start: "14:00", end: "15:00" };
    const b = { id: "b", key: "appointment", title: "Dinner", start: "19:00", end: "20:00" };
    let d = markDirty(undefined, { add_event: a }, row());
    d = markDirty(d, { add_event: b }, row());
    d = markDirty(d, { remove_event: "a" }, row());
    d = markDirty(d, { remove_event: "old" }, row());
    expect(d.addEvents).toEqual([b]);
    expect(d.removeEventIds).toEqual(["old"]);
  });

  it("a failed add stays queued unless removed meanwhile", () => {
    const a = { id: "a", key: "appointment", title: "Dentist", start: "14:00", end: "15:00" };
    const failed = markDirty(undefined, { add_event: a }, row());
    expect(requeue(failed, undefined).addEvents).toEqual([a]);
    expect(requeue(failed, markDirty(undefined, { remove_event: "a" }, row())).addEvents).toBeUndefined();
  });
});
