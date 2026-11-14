import { describe, expect, it } from "vitest";
import { DEFAULT_BLOCKS } from "@/content/blocks";
import { DEFAULT_TEMPLATES } from "@/content/defaults";
import { freeDaysFromContext } from "@/lib/share/compute";
import { slotFits } from "@/lib/share/freebusy";
import { localDate, localParts, zonedInstant } from "@/lib/time";
import { timelineFor, type DayContext, type DayPlanRow } from "@/lib/today/day";

/** M12 G7 R-M12-2 / R-M12-4: free time from the engine, always on its own wake-day's date. */
const TZ = "Asia/Bangkok";
const hm = (d: Date) => {
  const p = localParts(d, TZ);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};
const ctx = (wake: string, dayPlans: Record<string, DayPlanRow> = {}): DayContext => ({
  timezone: TZ,
  blocks: DEFAULT_BLOCKS,
  templates: DEFAULT_TEMPLATES.map((t, i) => ({ ...t, target_wake: wake, id: `t${i}`, name: null })),
  dayPlans,
});
const NOW = zonedInstant("2026-11-13", 8 * 60, TZ);

describe("share free days from the engine", () => {
  it("never offers time after the local midnight that ends the wake-day (R-M12-2)", () => {
    for (const wake of ["07:00", "10:00", "11:30", "13:00"]) {
      const days = freeDaysFromContext(ctx(wake), NOW);
      expect(days.length).toBe(14);
      for (const d of days)
        for (const i of d.free) {
          expect(localDate(i.start, TZ)).toBe(d.date);
          expect(localDate(new Date(i.end.getTime() - 1000), TZ)).toBe(d.date);
        }
    }
  });

  it("a slot fits only inside one free interval (R-M12-4)", () => {
    const days = freeDaysFromContext(ctx("07:00"), NOW);
    const d = days.find((x) => x.free.length > 0)!;
    const i = d.free[0];
    const s = new Date(i.start.getTime());
    expect(slotFits(days, s, new Date(s.getTime() + 30 * 60_000))).toBe(d.date);
    expect(
      slotFits(days, new Date(s.getTime() - 60 * 60_000), new Date(s.getTime() + 30 * 60_000)),
    ).toBeNull();
    expect(
      slotFits(days, new Date(i.end.getTime() - 10 * 60_000), new Date(i.end.getTime() + 20 * 60_000)),
    ).toBeNull();
    // 03:00 the next night (Sleep) is never free.
    const night = zonedInstant(d.date, 27 * 60, TZ);
    expect(slotFits(days, night, new Date(night.getTime() + 30 * 60_000))).toBeNull();
  });

  it("an accepted booking inside Free keeps the day as planned (no wake move, no conflict)", () => {
    const c = ctx("10:00");
    const days = freeDaysFromContext(c, NOW);
    const d = days.find((x) => x.free.length > 0)!;
    const start = d.free[0].start;
    const end = new Date(start.getTime() + 60 * 60_000);
    const before = timelineFor(c, d.date);
    const plan: DayPlanRow = {
      date: d.date,
      template_id: null,
      attending: null,
      bedtime_override: null,
      late_night: null,
      mode: "normal",
      overrides: {
        fixed_events: [
          {
            id: "booking-x",
            key: "appointment",
            title: "Ploy",
            host: "free",
            start: hm(start),
            end: hm(end),
          },
        ] as never,
      },
    };
    const after = timelineFor(ctx("10:00", { [d.date]: plan }), d.date);
    expect(after.blocks[0].start.toISOString()).toBe(before.blocks[0].start.toISOString());
    expect(after.warnings.map((w) => w.type)).not.toContain("fixed_event_conflict");
    expect(after.fixedEvents.map((e) => e.title)).toContain("Ploy");
  });
});

describe("planned time inside Free and away days are busy (G7 R-M12-14, Minnie 2026-11-14)", () => {
  const plan = (date: string, over: Partial<DayPlanRow>): DayPlanRow => ({
    date,
    template_id: null,
    attending: null,
    bedtime_override: null,
    late_night: null,
    mode: "normal",
    overrides: {},
    ...over,
  });

  it("a sick or vacation day shares no free time", () => {
    const base = freeDaysFromContext(ctx("07:00"), NOW);
    const [a, b] = base.filter((d) => d.free.length > 0).map((d) => d.date);
    const days = freeDaysFromContext(
      ctx("07:00", { [a]: plan(a, { mode: "sick" }), [b]: plan(b, { mode: "vacation" }) }),
      NOW,
    );
    expect(days.find((d) => d.date === a)?.free).toEqual([]);
    expect(days.find((d) => d.date === b)?.free).toEqual([]);
  });

  it("a gym or task slot inside Free is cut out of the free time", () => {
    const base = freeDaysFromContext(ctx("07:00"), NOW);
    const d = base.find((x) => x.free.length > 0)!;
    const free = d.free[0];
    const days = freeDaysFromContext(
      ctx("07:00", {
        [d.date]: plan(d.date, {
          overrides: {
            blocks: {
              free: {
                sub_slots: [{ id: "g", label: "Gym", offsetMin: 30, durationMin: 60, kind: "gym" }],
              },
            },
          },
        }),
      }),
      NOW,
    );
    const got = days.find((x) => x.date === d.date)!.free;
    const gymStart = new Date(free.start.getTime() + 30 * 60_000);
    const gymEnd = new Date(gymStart.getTime() + 60 * 60_000);
    for (const i of got) expect(i.end <= gymStart || i.start >= gymEnd).toBe(true);
    expect(got.some((i) => i.start.getTime() === gymEnd.getTime())).toBe(true);
  });
});
