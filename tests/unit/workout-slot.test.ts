import { expect, it } from "vitest";
import { applyDayPatch } from "@/lib/plan/usePlan";
import type { DayPlanRow } from "@/lib/today/day";

const row: DayPlanRow = {
  date: "2026-11-05",
  template_id: null,
  attending: null,
  bedtime_override: null,
  late_night: null,
  mode: "normal",
  overrides: { blocks: { free: { checklist: [{ id: "a", label: "Read" }] } } },
} as DayPlanRow;

it("a planned workout lands in that block's sub-slots and keeps the block's other overrides (SPEC §6)", () => {
  const slot = { id: "w1", label: "", kind: "gym" as const, offsetMin: 0, durationMin: 60 };
  const next = applyDayPatch(row, { block: { key: "free", sub_slots: [slot] } });
  expect(next.overrides.blocks?.free).toEqual({ checklist: [{ id: "a", label: "Read" }], sub_slots: [slot] });
  const removed = applyDayPatch(next, { block: { key: "free", sub_slots: [] } });
  expect(removed.overrides.blocks?.free?.sub_slots).toEqual([]);
  expect(row.overrides.blocks?.free?.sub_slots).toBeUndefined();
});
