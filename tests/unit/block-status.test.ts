import { describe, expect, it } from "vitest";
import { blockStatus } from "@/components/today/Timeline";
import type { TimelineBlock } from "@/lib/today/day";
import type { BlockLog } from "@/lib/today/useToday";

const b = {
  key: "focus",
  start: new Date("2026-11-03T04:00:00Z"),
  end: new Date("2026-11-03T05:30:00Z"),
} as TimelineBlock;
const after = new Date("2026-11-03T15:00:00Z");
const log = (over: Partial<BlockLog>) =>
  ({
    items_done: [],
    closed_at: null,
    started_at: null,
    first10_at: null,
    miss_reason: null,
    ...over,
  }) as BlockLog;

describe("block status on the timeline", () => {
  it("a block closed as missed in the Night ritual reads as missed, not done (R-M3-3)", () => {
    expect(
      blockStatus(b, log({ closed_at: after.toISOString(), miss_reason: "phone", backfilled: true }), after),
    ).toBe("missed");
  });
  it("a block finished for real reads as done", () => {
    expect(
      blockStatus(b, log({ closed_at: after.toISOString(), started_at: b.start.toISOString() }), after),
    ).toBe("done");
  });
});
