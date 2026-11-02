import { describe, expect, it } from "vitest";
import { FOREGROUND_REFRESH_MS, sameDayContext, shouldRefreshOnForeground } from "@/lib/today/foreground";
import type { DayContext } from "@/lib/today/day";

/** CJ-15 (S2): a quick hide/show must not refetch and re-render while the user is tapping. */
describe("shouldRefreshOnForeground", () => {
  const t0 = 1_000_000;
  it("never refreshes when the app was not hidden first", () => {
    expect(shouldRefreshOnForeground(null, t0)).toBe(false);
  });
  it("skips a quick flip (under 60 s)", () => {
    expect(shouldRefreshOnForeground(t0, t0 + 500)).toBe(false);
    expect(shouldRefreshOnForeground(t0, t0 + FOREGROUND_REFRESH_MS - 1)).toBe(false);
  });
  it("refreshes after being hidden for 60 s or more (iOS home-screen app left open)", () => {
    expect(shouldRefreshOnForeground(t0, t0 + FOREGROUND_REFRESH_MS)).toBe(true);
    expect(shouldRefreshOnForeground(t0, t0 + 8 * 3_600_000)).toBe(true);
  });
  it("treats a clock that moved backwards as a quick flip", () => {
    expect(shouldRefreshOnForeground(t0, t0 - 5_000)).toBe(false);
  });
});

describe("sameDayContext", () => {
  const ctx = (over: Partial<DayContext> = {}): DayContext => ({
    timezone: "Asia/Bangkok",
    blocks: [],
    templates: [],
    dayPlans: { "2026-10-28": { date: "2026-10-28", mode: "normal" } as never },
    ...over,
  });
  it("equal data → same (a refetch keeps the old object, so actions don't rebuild)", () => {
    expect(sameDayContext(ctx(), ctx())).toBe(true);
  });
  it("any change → different", () => {
    expect(sameDayContext(ctx(), ctx({ timezone: "UTC" }))).toBe(false);
    expect(sameDayContext(ctx(), ctx({ dayPlans: {} }))).toBe(false);
    expect(sameDayContext(ctx(), ctx({ gymClose: "21:00" }))).toBe(false);
  });
});
