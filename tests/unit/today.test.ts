import { describe, expect, it } from "vitest";
import { DEFAULT_BLOCKS } from "@/content/blocks";
import { DEFAULT_TEMPLATES } from "@/content/defaults";
import { parseHHMM } from "@/lib/engine";
import {
  currentBlock,
  currentDayDate,
  emptyBlocks,
  inWakeWindow,
  isOnTime,
  isPastBlock,
  pickWakeCard,
  hasKindOfDay,
  planFor,
  plannedWake,
  templateFor,
  timelineFor,
  type DayContext,
} from "@/lib/today/day";
import { localParts, zonedInstant } from "@/lib/time";

const TZ = "Asia/Bangkok";
const at = (d: string, t: string) => zonedInstant(d, parseHHMM(t), TZ);
const hm = (d: Date) => {
  const p = localParts(d, TZ);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};
const templates = DEFAULT_TEMPLATES.map((t, i) => ({ ...t, id: `t${i}`, name: null }));
const ctx = (over: Partial<DayContext> = {}): DayContext => ({
  timezone: TZ,
  blocks: DEFAULT_BLOCKS,
  templates,
  dayPlans: {},
  ...over,
});

describe("which day is today (wake → next wake)", () => {
  it("before today's wake it is still yesterday's day", () => {
    expect(currentDayDate(ctx(), at("2026-11-03", "01:30"))).toBe("2026-11-02");
    expect(currentDayDate(ctx(), at("2026-11-03", "09:59"))).toBe("2026-11-02");
    expect(currentDayDate(ctx(), at("2026-11-03", "10:00"))).toBe("2026-11-03");
    // Wed class day wakes at 07:30
    expect(currentDayDate(ctx(), at("2026-11-04", "07:45"))).toBe("2026-11-04");
  });

  it("a pressed or frozen wake keeps the day started, like the server (R-M9-R2-1)", () => {
    // Pressed at 09:05 for a 09:00 target, then the kind of day moved to 10:00: still today at 09:30.
    const pinned = { "2026-11-03": at("2026-11-03", "09:00").toISOString() };
    expect(currentDayDate(ctx(), at("2026-11-03", "09:30"), pinned)).toBe("2026-11-03");
    expect(currentDayDate(ctx(), at("2026-11-03", "08:30"), pinned)).toBe("2026-11-02");
    expect(currentDayDate(ctx(), at("2026-11-03", "09:30"))).toBe("2026-11-02");
  });

  it("an early 'I'm up' starts the day before its target (playtest R1 P2)", () => {
    // Target 10:00, pressed at 09:20: from then on it's the new day, not yesterday's Down Time.
    const pressed = new Set(["2026-11-03"]);
    expect(currentDayDate(ctx(), at("2026-11-03", "09:25"), undefined, pressed)).toBe("2026-11-03");
    expect(currentDayDate(ctx(), at("2026-11-03", "09:25"))).toBe("2026-11-02");
    // A press on another date doesn't start this one.
    expect(currentDayDate(ctx(), at("2026-11-03", "09:25"), undefined, new Set(["2026-11-02"]))).toBe(
      "2026-11-02",
    );
  });

  it("uses the profile timezone, not the machine's", () => {
    const ny = ctx({ timezone: "America/New_York" });
    const t = new Date("2026-11-03T14:30:00Z"); // 09:30 NY → before 10:00 wake
    expect(currentDayDate(ny, t)).toBe("2026-11-02");
  });
});

describe("timeline", () => {
  it("is Wake…Free of D then tonight's Down and Sleep, all logged under D", () => {
    const t = timelineFor(ctx(), "2026-11-02");
    expect(t.blocks.map((b) => b.key)).toEqual([
      "wake",
      "focus",
      "work",
      "gradation",
      "free",
      "down",
      "sleep",
    ]);
    expect(t.blocks.every((b) => b.logDate === "2026-11-02")).toBe(true);
    expect(hm(t.blocks[0].start)).toBe("10:00");
    expect(hm(t.blocks[5].start)).toBe("01:00"); // tonight's Down
    expect(t.blocks[6].end.getTime()).toBe(planFor(ctx(), "2026-11-03").wake.getTime());
    for (let i = 1; i < t.blocks.length; i++)
      expect(t.blocks[i].start.getTime()).toBe(t.blocks[i - 1].end.getTime());
  });

  it("shows fixed events and default first-10 (null = i18n default)", () => {
    const t = timelineFor(ctx(), "2026-11-04");
    expect(t.fixedEvents).toHaveLength(1);
    expect(t.blocks.find((b) => b.key === "work")!.first10).toBeNull();
  });

  it("per-day overrides change only that day (checklist, duration, template, attending)", () => {
    const c = ctx({
      dayPlans: {
        "2026-11-05": {
          date: "2026-11-05",
          template_id: null,
          attending: false,
          bedtime_override: null,
          late_night: null,
          mode: "normal",
          overrides: {
            blocks: {
              focus: { checklist: [{ id: "a", label: "Read" }], duration_min: 60, first10: "Open notes" },
            },
          },
        },
      },
    });
    const thu = timelineFor(c, "2026-11-05");
    expect(hm(thu.wakeTarget)).toBe("10:00"); // skipping class
    const focus = thu.blocks.find((b) => b.key === "focus")!;
    expect(focus.checklist).toEqual([{ id: "a", label: "Read" }]);
    expect(focus.first10).toBe("Open notes");
    expect(focus.durationMin).toBe(60);
    expect(timelineFor(c, "2026-11-12").blocks.find((b) => b.key === "focus")!.checklist).toEqual([]);
  });

  it("explicit template choice beats the weekday default", () => {
    const c = ctx({
      dayPlans: {
        "2026-11-07": {
          date: "2026-11-07",
          template_id: "t5",
          attending: null,
          bedtime_override: null,
          late_night: null,
          mode: "normal",
          overrides: {},
        },
      },
    });
    expect(templateFor(c, "2026-11-07")!.key).toBe("home_weekend");
    expect(templateFor(c, "2026-11-08")!.key).toBe("family_sun");
  });

  it("bedtime override and late night flow through; vacation mode is reported", () => {
    const c = ctx({
      dayPlans: {
        "2026-11-03": {
          date: "2026-11-03",
          template_id: null,
          attending: null,
          bedtime_override: null,
          late_night: { return_at: at("2026-11-03", "03:30").toISOString() },
          mode: "vacation",
          overrides: {},
        },
      },
    });
    const t = timelineFor(c, "2026-11-02");
    expect(t.planned).toBe(true);
    expect(hm(t.blocks.find((b) => b.key === "sleep")!.start)).toBe("04:00");
    expect(timelineFor(c, "2026-11-03").mode).toBe("vacation");
  });

  it("finds the current block", () => {
    const t = timelineFor(ctx(), "2026-11-02");
    expect(currentBlock(t, at("2026-11-02", "13:00"))!.key).toBe("work");
    expect(currentBlock(t, at("2026-11-03", "01:15"))!.key).toBe("down");
    expect(currentBlock(t, at("2026-11-02", "09:00"))).toBeUndefined();
  });
});

describe("check-in rules", () => {
  it("on time = within ±10 min of planned start", () => {
    const p = at("2026-11-02", "11:00");
    expect(isOnTime(p, at("2026-11-02", "11:10"))).toBe(true);
    expect(isOnTime(p, at("2026-11-02", "10:50"))).toBe(true);
    expect(isOnTime(p, at("2026-11-02", "11:11"))).toBe(false);
  });

  it("past blocks are backfills", () => {
    const end = at("2026-11-02", "12:30");
    expect(isPastBlock({ end }, at("2026-11-02", "12:31"))).toBe(true);
    expect(isPastBlock({ end }, at("2026-11-02", "12:00"))).toBe(false);
  });

  it("wake window: up to 15 min late, up to 3 h early", () => {
    const target = at("2026-11-02", "10:00");
    expect(inWakeWindow(target, at("2026-11-02", "10:10"))).toBe(true);
    expect(inWakeWindow(target, at("2026-11-02", "10:15"))).toBe(true);
    expect(inWakeWindow(target, at("2026-11-02", "10:20"))).toBe(false);
    expect(inWakeWindow(target, at("2026-11-02", "08:00"))).toBe(true);
    expect(inWakeWindow(target, at("2026-11-02", "06:30"))).toBe(false);
  });
});

describe("regression: tomorrow's bedtime override", () => {
  const row = (date: string, over: Partial<import("@/lib/today/day").DayPlanRow>) => ({
    date,
    template_id: null,
    attending: null,
    bedtime_override: null,
    late_night: null,
    mode: "normal" as const,
    overrides: {},
    ...over,
  });

  it("today's Free ends exactly when tonight's (overridden) Down starts — no gap", () => {
    const c = ctx({
      dayPlans: {
        "2026-11-03": row("2026-11-03", { bedtime_override: at("2026-11-03", "02:45").toISOString() }),
      },
    });
    const t = timelineFor(c, "2026-11-02");
    for (let i = 1; i < t.blocks.length; i++)
      expect(t.blocks[i].start.getTime()).toBe(t.blocks[i - 1].end.getTime());
    expect(hm(t.blocks.find((b) => b.key === "free")!.end)).toBe("01:15");
    expect(hm(t.blocks.find((b) => b.key === "sleep")!.start)).toBe("02:45");
  });

  it("same with a late night planned for tonight", () => {
    const c = ctx({
      dayPlans: {
        "2026-11-03": row("2026-11-03", {
          late_night: { return_at: at("2026-11-03", "03:30").toISOString() },
        }),
      },
    });
    const t = timelineFor(c, "2026-11-02");
    for (let i = 1; i < t.blocks.length; i++)
      expect(t.blocks[i].start.getTime()).toBe(t.blocks[i - 1].end.getTime());
    expect(hm(t.blocks.find((b) => b.key === "down")!.start)).toBe("03:30");
  });
});

describe("wake card (review M3-F2a/b)", () => {
  const w = (date: string) => ({ date, pressed_at: at(date, "10:05").toISOString(), in_window: true });
  const wakes = { "2026-11-02": w("2026-11-02") };

  it("late evening / after midnight: shows yesterday's result, no button", () => {
    const now = at("2026-11-03", "01:00");
    const card = pickWakeCard(ctx(), now, currentDayDate(ctx(), now), wakes)!;
    expect(card).toMatchObject({ date: "2026-11-02", canPress: false });
  });

  it("early riser: 1 h before today's 10:00 target the button shows", () => {
    const now = at("2026-11-03", "09:00");
    const card = pickWakeCard(ctx(), now, currentDayDate(ctx(), now), wakes)!;
    expect(card).toMatchObject({ date: "2026-11-03", event: null, canPress: true });
    expect(hm(card.target)).toBe("10:00");
  });

  it("app left open overnight: the same inputs flip to the button as time passes", () => {
    const early = at("2026-11-03", "06:59");
    const later = at("2026-11-03", "07:00");
    expect(pickWakeCard(ctx(), early, currentDayDate(ctx(), early), wakes)!.canPress).toBe(false);
    expect(pickWakeCard(ctx(), later, currentDayDate(ctx(), later), wakes)!.canPress).toBe(true);
  });

  it("after pressing today: shows today's result; no card when there's nothing to show", () => {
    const now = at("2026-11-03", "10:30");
    const pressed = { ...wakes, "2026-11-03": w("2026-11-03") };
    expect(pickWakeCard(ctx(), now, "2026-11-03", pressed)).toMatchObject({
      date: "2026-11-03",
      canPress: false,
    });
    expect(pickWakeCard(ctx(), at("2026-11-03", "01:00"), "2026-11-02", {})).toBeNull();
  });
});

describe("plannedWake (what the server needs to honor a planned push)", () => {
  it("a +90 bedtime push on a free day: wake 11:30 planned from the 10:00 template target", () => {
    const c = ctx({
      dayPlans: {
        "2026-11-02": {
          date: "2026-11-02",
          template_id: null,
          attending: null,
          bedtime_override: at("2026-11-02", "04:00").toISOString(),
          late_night: null,
          mode: "normal",
          overrides: {},
        },
      },
    });
    const p = plannedWake(c, "2026-11-02");
    expect(hm(new Date(p.wake))).toBe("11:30");
    expect(hm(new Date(p.base))).toBe("10:00");
  });

  it("skipping the optional Thursday class plans from the alternate target", () => {
    const c = ctx({
      dayPlans: {
        "2026-11-05": {
          date: "2026-11-05",
          template_id: null,
          attending: false,
          bedtime_override: null,
          late_night: null,
          mode: "normal",
          overrides: {},
        },
      },
    });
    const p = plannedWake(c, "2026-11-05");
    expect(hm(new Date(p.base))).toBe("10:00");
    expect(p.wake).toBe(p.base);
  });
});

describe("a weekday without a kind of day (R-M4-11)", () => {
  it("falls back instead of crashing Plan/Today/the ritual, and says so", () => {
    // Wednesday (3) belongs to no auto-applied kind, e.g. after a half-saved setup.
    const c = ctx({
      templates: templates.map((t) => ({ ...t, weekdays: t.weekdays.filter((d) => d !== 3) })),
    });
    expect(() => planFor(c, "2026-11-04")).not.toThrow();
    expect(templateFor(c, "2026-11-04")).toBeDefined();
    expect(hasKindOfDay(c, "2026-11-04")).toBe(false);
    expect(hasKindOfDay(c, "2026-11-03")).toBe(true);
  });
  it("even with no kinds at all, the built-in default keeps the app usable", () => {
    expect(() => planFor(ctx({ templates: [] }), "2026-11-04")).not.toThrow();
  });
});

describe("bedtime drift guardrail (SPEC §3, R-M4-8)", () => {
  const pushed = (minutes: number) =>
    ctx({
      dayPlans: {
        "2026-11-02": {
          date: "2026-11-02",
          template_id: null,
          attending: null,
          bedtime_override: new Date(at("2026-11-02", "02:30").getTime() + minutes * 60_000).toISOString(),
          late_night: null,
          mode: "normal",
          overrides: {},
        },
      },
    });
  const drift = (c: DayContext) => planFor(c, "2026-11-02").warnings.find((w) => w.type === "bedtime_drift");
  it("warns when tonight is pushed more than 60 min past this kind of day's recent bedtimes", () => {
    expect(drift(pushed(90))).toMatchObject({ deltaMin: 90 });
  });
  it("stays quiet for a small push, an unpushed night, or a different kind of day", () => {
    expect(drift(pushed(30))).toBeUndefined();
    expect(drift(ctx())).toBeUndefined();
    expect(planFor(ctx(), "2026-11-04").warnings.find((w) => w.type === "bedtime_drift")).toBeUndefined();
  });
});

describe("a target the server froze is the one Today shows (R2-4)", () => {
  it("after a late edit, the wake card uses the frozen target", () => {
    const now = at("2026-11-02", "09:50");
    const plain = pickWakeCard(ctx(), now, "2026-11-02", {});
    expect(hm(plain!.target)).toBe("10:00");
    const frozen = pickWakeCard(
      ctx(),
      now,
      "2026-11-02",
      {},
      { "2026-11-02": at("2026-11-02", "08:00").toISOString() },
    );
    expect(hm(frozen!.target)).toBe("08:00");
  });
});

describe("an early appointment pulls the wake (R3-1: the server honours it within −6 h)", () => {
  it("06:00 flight on a 10:00 free day: Today and the planned wake both say 06:00", () => {
    const c = ctx({
      dayPlans: {
        "2026-11-02": {
          date: "2026-11-02",
          template_id: null,
          attending: null,
          bedtime_override: null,
          late_night: null,
          mode: "normal",
          overrides: {
            fixed_events: [
              { id: "f", key: "appointment", title: "Flight", start: "06:00", end: "07:00", host: "wake" },
            ],
          },
        },
      },
    });
    const p = plannedWake(c, "2026-11-02");
    expect(hm(new Date(p.wake))).toBe("06:00");
    expect(hm(new Date(p.base))).toBe("10:00");
    expect(hm(pickWakeCard(c, at("2026-11-02", "05:30"), "2026-11-02", {})!.target)).toBe("06:00");
  });
});

describe("a block with no time left today (playtest R1 P1)", () => {
  it("is listed as empty, so it can be set aside instead of judged as missed", () => {
    const blocks = DEFAULT_BLOCKS.map((b) => (b.key === "focus" ? { ...b, duration_min: 0 } : b));
    const t = timelineFor(ctx({ blocks }), "2026-11-02");
    expect(emptyBlocks(t).map((b) => b.key)).toEqual(["focus"]);
    expect(emptyBlocks(timelineFor(ctx(), "2026-11-02"))).toEqual([]);
  });
});

describe("timeline status of a set-aside block", () => {
  it("is 'setAside', not 'missed', once its time has passed", async () => {
    const { blockStatus } = await import("@/components/today/Timeline");
    const t = timelineFor(ctx(), "2026-11-02");
    const b = t.blocks[1]!;
    const log = {
      date: "2026-11-02",
      block: b.key,
      planned_start: null,
      started_at: null,
      first10_at: null,
      closed_at: null,
      items_done: [],
      items_planned: 0,
      mood: null,
      energy: null,
      location: null,
      backfilled: false,
      miss_reason: null,
      planned_deviation: true,
    };
    const later = new Date(b.end.getTime() + 60_000);
    expect(blockStatus(b, log, later)).toBe("setAside");
    expect(blockStatus(b, { ...log, planned_deviation: false }, later)).toBe("missed");
  });
});
