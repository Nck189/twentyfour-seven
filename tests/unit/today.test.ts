import { describe, expect, it } from "vitest";
import { DEFAULT_BLOCKS } from "@/content/blocks";
import { DEFAULT_TEMPLATES } from "@/content/defaults";
import { parseHHMM } from "@/lib/engine";
import {
  currentBlock,
  currentDayDate,
  inWakeWindow,
  isOnTime,
  isPastBlock,
  pickWakeCard,
  planFor,
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

  it("throws clearly when no template covers a day", () => {
    expect(() => planFor(ctx({ templates: [] }), "2026-11-02")).toThrow(/no template/);
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
