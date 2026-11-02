import { describe, expect, it } from "vitest";
import { addDays, isoWeekday, localDate, localParts, tzOffsetMinutes, zonedInstant } from "@/lib/time";

describe("time helpers", () => {
  it("computes the Bangkok calendar date, not the UTC one", () => {
    // 2026-11-02 18:30 UTC = 2026-11-03 01:30 Bangkok
    expect(localDate(new Date("2026-11-02T18:30:00Z"))).toBe("2026-11-03");
    expect(localDate(new Date("2026-11-02T18:30:00Z"), "UTC")).toBe("2026-11-02");
  });

  it("returns local wall-clock parts", () => {
    expect(localParts(new Date("2026-11-02T03:00:00Z"))).toEqual({
      year: 2026,
      month: 11,
      day: 2,
      hour: 10,
      minute: 0,
    });
  });

  it("Bangkok offset is +420 minutes", () => {
    expect(tzOffsetMinutes(new Date("2026-06-01T00:00:00Z"))).toBe(420);
  });

  it("converts local wall time to UTC, including across midnight", () => {
    expect(zonedInstant("2026-11-04", 7 * 60 + 30).toISOString()).toBe("2026-11-04T00:30:00.000Z");
    expect(zonedInstant("2026-11-04", 23 * 60).toISOString()).toBe("2026-11-04T16:00:00.000Z");
    // minutes beyond 24h roll into the next day
    expect(zonedInstant("2026-11-04", 25 * 60).toISOString()).toBe("2026-11-04T18:00:00.000Z");
  });

  it("is timezone-agnostic: works for a DST zone", () => {
    // New York, 2026-03-08 is DST start (02:00 → 03:00). 09:00 local = 13:00 UTC (EDT).
    expect(zonedInstant("2026-03-08", 9 * 60, "America/New_York").toISOString()).toBe(
      "2026-03-08T13:00:00.000Z",
    );
    expect(zonedInstant("2026-03-07", 9 * 60, "America/New_York").toISOString()).toBe(
      "2026-03-07T14:00:00.000Z",
    );
  });

  it("adds days across month end and leap day", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("returns ISO weekdays", () => {
    expect(isoWeekday("2026-11-02")).toBe(1); // Monday
    expect(isoWeekday("2026-11-08")).toBe(7); // Sunday
  });
});
