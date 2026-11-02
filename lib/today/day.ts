import type { BlockKey, BlockSetting, ChecklistItem } from "@/content/blocks";
import type { FixedEvent, TemplateDefault } from "@/content/defaults";
import {
  planDay,
  resolveDay,
  templateForWeekday,
  type DayPlan,
  type PlannedBlock,
  type SubSlot,
  type Warning,
} from "@/lib/engine";
import { addDays, isoWeekday, localDate } from "@/lib/time";

/** A template row as stored (id + content). */
export type TemplateRow = TemplateDefault & { id: string; name: string | null };

export type DayPlanRow = {
  date: string;
  template_id: string | null;
  attending: boolean | null;
  bedtime_override: string | null;
  late_night: { return_at: string } | null;
  mode: "normal" | "vacation" | "sick";
  overrides: {
    blocks?: Partial<
      Record<
        BlockKey,
        { duration_min?: number; checklist?: ChecklistItem[]; first10?: string | null; sub_slots?: SubSlot[] }
      >
    >;
    fixed_events?: FixedEvent[];
  };
};

export type DayContext = {
  timezone: string;
  blocks: BlockSetting[];
  templates: TemplateRow[];
  /** day_plans keyed by date. */
  dayPlans: Record<string, DayPlanRow | undefined>;
  gymClose?: string;
};

export function templateFor(ctx: DayContext, date: string): TemplateRow | undefined {
  const row = ctx.dayPlans[date];
  if (row?.template_id) {
    const t = ctx.templates.find((x) => x.id === row.template_id);
    if (t) return t;
  }
  return templateForWeekday(ctx.templates, isoWeekday(date));
}

/** Tomorrow's real bedtime and Down length when it was overridden (bedtime push / late night). */
function nextNight(
  ctx: DayContext,
  next: string,
  depth: number,
): { nextBedtimeOverride?: Date; nextDownMin?: number } {
  const row = ctx.dayPlans[next];
  if (depth > 0 || !(row?.bedtime_override || row?.late_night)) return {};
  const p = planFor(ctx, next, 1);
  return { nextBedtimeOverride: p.bedtime, nextDownMin: p.blocks[0].durationMin };
}

/** Engine plan for date D from templates + per-day overrides. Templates stay untouched. */
export function planFor(ctx: DayContext, date: string, depth = 0): DayPlan {
  const next = addDays(date, 1);
  const row = ctx.dayPlans[date];
  const tpl = templateFor(ctx, date);
  const nextTpl = templateFor(ctx, next);
  if (!tpl || !nextTpl) throw new Error(`no template for ${date}`);
  const blockSettings = ctx.blocks.map((b) => ({
    key: b.key,
    duration_min: row?.overrides.blocks?.[b.key]?.duration_min ?? b.duration_min,
  }));
  const day = resolveDay(tpl, blockSettings, {
    attending: row?.attending,
    extraFixedEvents: row?.overrides.fixed_events,
  });
  const nextDay = resolveDay(nextTpl, ctx.blocks, { attending: ctx.dayPlans[next]?.attending });
  const subSlots = Object.fromEntries(
    Object.entries(row?.overrides.blocks ?? {}).map(([k, v]) => [k, v?.sub_slots ?? []]),
  ) as Partial<Record<BlockKey, SubSlot[]>>;
  return planDay({
    date,
    timezone: ctx.timezone,
    targetWake: day.targetWake,
    nextTargetWake: nextDay.targetWake,
    durations: day.durations,
    nextSleepMin: nextDay.durations.sleep,
    fixedEvents: day.fixedEvents,
    subSlots,
    bedtimeOverride: row?.bedtime_override ? new Date(row.bedtime_override) : undefined,
    // The day ends at tomorrow's real bedtime (override / late night), not just the template target.
    ...nextNight(ctx, next, depth),
    lateNightReturn: row?.late_night?.return_at ? new Date(row.late_night.return_at) : undefined,
    gymClose: ctx.gymClose,
  });
}

/**
 * The wake-day containing `now`: a day runs wake → next wake (CLAUDE.md "Time").
 * Before today's wake it's still yesterday's day.
 */
export function currentDayDate(ctx: DayContext, now: Date): string {
  const d0 = localDate(now, ctx.timezone);
  return now.getTime() < planFor(ctx, d0).wake.getTime() ? addDays(d0, -1) : d0;
}

export type TimelineBlock = PlannedBlock & {
  /** Wake-day this block's log belongs to. */
  logDate: string;
  checklist: ChecklistItem[];
  first10: string | null;
};

export type Timeline = {
  date: string;
  wakeTarget: Date;
  blocks: TimelineBlock[];
  fixedEvents: DayPlan["fixedEvents"];
  warnings: Warning[];
  mode: DayPlanRow["mode"];
  planned: boolean;
};

function blockMeta(ctx: DayContext, date: string, key: BlockKey) {
  const base = ctx.blocks.find((b) => b.key === key)!;
  const tpl = templateFor(ctx, date);
  const override = ctx.dayPlans[date]?.overrides.blocks?.[key];
  return {
    checklist: override?.checklist ?? tpl?.blocks?.[key]?.checklist ?? base.checklist,
    first10:
      override?.first10 !== undefined ? override.first10 : (tpl?.blocks?.[key]?.first10 ?? base.first10),
  };
}

/**
 * "My day" for wake-day D: Wake → Free from D's plan, then tonight's Down and Sleep from D+1's plan.
 * All 7 blocks are logged under date D.
 */
export function timelineFor(ctx: DayContext, date: string): Timeline {
  const today = planFor(ctx, date);
  const tonight = planFor(ctx, addDays(date, 1));
  const day: TimelineBlock[] = today.blocks
    .filter((b) => b.key !== "down" && b.key !== "sleep")
    .map((b) => ({ ...b, logDate: date, ...blockMeta(ctx, date, b.key) }));
  const night: TimelineBlock[] = tonight.blocks
    .filter((b) => b.key === "down" || b.key === "sleep")
    .map((b) => ({ ...b, logDate: date, ...blockMeta(ctx, date, b.key) }));
  return {
    date,
    wakeTarget: today.wake,
    blocks: [...day, ...night],
    fixedEvents: today.fixedEvents,
    warnings: [
      ...today.warnings,
      ...tonight.warnings.filter((w) => w.type === "short_sleep" || w.type === "bedtime_drift"),
    ],
    mode: ctx.dayPlans[date]?.mode ?? "normal",
    planned: tonight.planned,
  };
}

export function currentBlock(t: Timeline, now: Date): TimelineBlock | undefined {
  return t.blocks.find((b) => b.start.getTime() <= now.getTime() && now.getTime() < b.end.getTime());
}

export const ON_TIME_MIN = 10;

/** SPEC §4.3: on time = started within ±10 min of the planned start. */
export function isOnTime(plannedStart: Date, startedAt: Date): boolean {
  return Math.abs(startedAt.getTime() - plannedStart.getTime()) <= ON_TIME_MIN * 60_000;
}

/** A block whose end has passed is logged as a backfill (no tickets or mutations). */
export function isPastBlock(block: Pick<TimelineBlock, "end">, now: Date): boolean {
  return now.getTime() > block.end.getTime();
}

/** Wake window (SPEC §4.2): within 15 min after the target (up to 3 h early). */
export function inWakeWindow(target: Date, pressed: Date, windowMin = 15): boolean {
  const diff = pressed.getTime() - target.getTime();
  return diff <= windowMin * 60_000 && diff >= -180 * 60_000;
}

/** The server accepts "I'm up" from 3 h before the target (see press_wake). */
export const WAKE_EARLY_MS = 3 * 3600_000;

export type WakeLike = { date: string; pressed_at: string; in_window: boolean };

/**
 * Which "I'm up" card to show. Same rule as the server: a press belongs to the calendar date.
 * From 3 h before today's target the card is today's (button or result); before that it shows
 * the last result (e.g. yesterday's) and no button.
 */
export function pickWakeCard<W extends WakeLike>(
  ctx: DayContext,
  now: Date,
  dayDate: string,
  wakes: Record<string, W>,
): { date: string; target: Date; event: W | null; canPress: boolean } | null {
  const calDate = localDate(now, ctx.timezone);
  const target = planFor(ctx, calDate).wake;
  if (now.getTime() >= target.getTime() - WAKE_EARLY_MS) {
    return { date: calDate, target, event: wakes[calDate] ?? null, canPress: !wakes[calDate] };
  }
  const prev = wakes[dayDate];
  return prev ? { date: dayDate, target: planFor(ctx, dayDate).wake, event: prev, canPress: false } : null;
}
