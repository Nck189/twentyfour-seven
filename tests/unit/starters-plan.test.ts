import { describe, expect, it } from "vitest";
import { DEFAULT_BLOCKS } from "@/content/blocks";
import { STARTERS } from "@/content/starters";
import { addDays } from "@/lib/time";
import { timelineFor, type DayContext } from "@/lib/today/day";

/** G8 presets (M14): every starter's week plans without conflicts or short sleep. */
describe("starter weeks plan cleanly", () => {
  it.each(STARTERS.map((s) => [s.key, s] as const))("%s", (_, s) => {
    const ctx: DayContext = {
      timezone: "Asia/Bangkok",
      blocks: DEFAULT_BLOCKS,
      templates: s.kinds.map((k, i) => ({
        id: `t${i}`,
        name: null,
        key: k.key,
        weekdays: k.weekdays,
        auto_apply: true,
        target_wake: k.wake,
        options: {},
        blocks: { sleep: { duration_min: k.sleepMin } },
        fixed_events: k.events,
        sort: i,
      })),
      dayPlans: {},
    };
    for (let d = 0; d < 7; d++) {
      const tl = timelineFor(ctx, addDays("2026-11-16", d));
      const bad = tl.warnings.filter((w) => w.type === "fixed_event_conflict" || w.type === "short_sleep");
      expect(bad).toEqual([]);
    }
  });
});
