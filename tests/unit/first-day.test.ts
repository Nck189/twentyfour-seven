import { describe, expect, it } from "vitest";
import { DEFAULT_BLOCKS } from "@/content/blocks";
import { DEFAULT_TEMPLATES } from "@/content/defaults";
import { parseHHMM } from "@/lib/engine";
import type { DayContext } from "@/lib/today/day";
import { isFirstDay, missedFirstWake } from "@/lib/today/firstDay";
import { zonedInstant } from "@/lib/time";

const TZ = "Asia/Bangkok";
const at = (d: string, t: string, tz = TZ) => zonedInstant(d, parseHHMM(t), tz);
const templates = DEFAULT_TEMPLATES.map((t, i) => ({ ...t, id: `t${i}`, name: null }));
const ctx = (over: Partial<DayContext> = {}): DayContext => ({
  timezone: TZ,
  blocks: DEFAULT_BLOCKS,
  templates,
  dayPlans: {},
  ...over,
});

describe("a new account's first day (review fix C1)", () => {
  it("is the wake-day the account was made in, and only that one", () => {
    // Tue 2026-11-03 wakes at 10:00 by default.
    const made = at("2026-11-03", "23:00");
    expect(isFirstDay(ctx(), made, "2026-11-03")).toBe(true);
    expect(isFirstDay(ctx(), made, "2026-11-04")).toBe(false);
    // Made after midnight but before the wake: still the day before's wake-day.
    expect(isFirstDay(ctx(), at("2026-11-04", "01:30"), "2026-11-03")).toBe(true);
  });

  it("follows the account's own timezone", () => {
    const ny = ctx({ timezone: "America/New_York" });
    const made = at("2026-11-03", "23:00", "America/New_York");
    expect(isFirstDay(ny, made, "2026-11-03")).toBe(true);
    expect(isFirstDay(ny, made, "2026-11-04")).toBe(false);
  });

  it("today's 'I'm up' is missed when the account came after its window closed", () => {
    const target = at("2026-11-03", "10:00");
    expect(missedFirstWake(at("2026-11-03", "23:00"), target)).toBe(true);
    expect(missedFirstWake(at("2026-11-03", "10:16"), target)).toBe(true);
    // Still inside the 15-minute window, or before the target: offer it.
    expect(missedFirstWake(at("2026-11-03", "10:15"), target)).toBe(false);
    expect(missedFirstWake(at("2026-11-03", "08:00"), target)).toBe(false);
    // A longer window from settings.
    expect(missedFirstWake(at("2026-11-03", "10:30"), target, 45)).toBe(false);
  });
});
