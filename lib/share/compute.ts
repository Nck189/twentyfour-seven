/**
 * Free time for the next SHARE_DAYS days from the engine inputs (server page and the owner's card).
 * Each wake-day's Free block minus that day's fixed events (classes, appointments, accepted
 * bookings); see freebusy.ts for the rules.
 */
import type { BlockSetting } from "@/content/blocks";
import { addDays } from "@/lib/time";
import { timelineFor, type DayContext, type DayPlanRow, type TemplateRow } from "@/lib/today/day";
import { freeForDay, SHARE_DAYS, type DayFree } from "./freebusy";

export type ShareContext = {
  timezone: string;
  locale: "en" | "th";
  name: string | null;
  settings: { blocks: BlockSetting[]; gym_close_time: string } | null;
  templates: TemplateRow[];
  day_plans: DayPlanRow[];
};

export function contextFrom(
  c: ShareContext & { settings: NonNullable<ShareContext["settings"]> },
): DayContext {
  return {
    timezone: c.timezone,
    blocks: c.settings.blocks,
    templates: c.templates,
    dayPlans: Object.fromEntries(c.day_plans.map((p) => [p.date, p])),
    gymClose: c.settings.gym_close_time.slice(0, 5),
  };
}

export function freeDaysFromContext(ctx: DayContext, now: Date, days = SHARE_DAYS): DayFree[] {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: ctx.timezone }).format(now);
  const out: DayFree[] = [];
  // Free time stays on its wake-day's calendar date (freebusy.ts), so yesterday's is always over.
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const tl = timelineFor(ctx, date);
    // A sick or vacation day is busy all day; planned slots inside Free (gym, tasks) are busy too
    // (G7 R-M12-14, Minnie 2026-11-14).
    const free = tl.mode === "normal" ? tl.blocks.find((b) => b.key === "free") : undefined;
    const day = freeForDay({
      date,
      free: free ? { start: free.start, end: free.end } : null,
      fixed: [
        ...tl.fixedEvents.map((e) => ({ start: e.start, end: e.end })),
        ...(free?.subSlots ?? []).map((s) => ({ start: s.start, end: s.end })),
      ],
      now,
      tz: ctx.timezone,
    });
    out.push(day);
  }
  return out;
}
