import { ON_TIME_MIN } from "@/content/game";
import type { BlockKey, BlockSetting, ChecklistItem } from "@/content/blocks";
import { DEFAULT_TEMPLATES, type FixedEvent, type TemplateDefault } from "@/content/defaults";
import {
  parseHHMM,
  planDay,
  resolveDay,
  templateForWeekday,
  type DayPlan,
  type PlannedBlock,
  type SubSlot,
  type Warning,
} from "@/lib/engine";
import { addDays, isoWeekday, localDate, zonedInstant } from "@/lib/time";

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

/** Used when no kind of day exists at all (never seeded / all removed): the built-in free day. */
const BUILT_IN: TemplateRow = { ...DEFAULT_TEMPLATES[0], id: "built-in", name: null };

/** Whether D has a kind of day of its own (its weekday is claimed, or the day picked one). */
export function hasKindOfDay(ctx: DayContext, date: string): boolean {
  const id = ctx.dayPlans[date]?.template_id;
  return Boolean(
    (id && ctx.templates.some((x) => x.id === id)) || templateForWeekday(ctx.templates, isoWeekday(date)),
  );
}

/**
 * The kind of day for D. A weekday nobody claims (e.g. a half-saved setup) falls back to the
 * first kind, then the built-in free day, so Plan/Today never crash (R-M4-11); Plan says so.
 */
export function templateFor(ctx: DayContext, date: string): TemplateRow {
  const row = ctx.dayPlans[date];
  if (row?.template_id) {
    const t = ctx.templates.find((x) => x.id === row.template_id);
    if (t) return t;
  }
  return (
    templateForWeekday(ctx.templates, isoWeekday(date)) ??
    ctx.templates.find((x) => x.auto_apply) ??
    ctx.templates[0] ??
    BUILT_IN
  );
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
    // Drift guardrail: only for a pushed night, against this kind of day's recent bedtimes.
    recentBedtimes:
      depth === 0 && (row?.bedtime_override || row?.late_night)
        ? recentBedtimes(ctx, date, tpl.id)
        : undefined,
  });
}

/** Planned bedtimes of the last 7 days that used the same kind of day (SPEC §3 guardrail). */
function recentBedtimes(ctx: DayContext, date: string, templateId: string): Date[] {
  const out: Date[] = [];
  for (let i = 1; i <= 7; i++) {
    const d = addDays(date, -i);
    if (templateFor(ctx, d).id === templateId) out.push(planFor(ctx, d, 1).bedtime);
  }
  return out;
}

/**
 * What the server needs to honor a planned push (Sunrise window, SPEC §4.2): the engine's wake
 * for D and the template target it was planned from. Saved with the day plan as `planned`; the
 * server only trusts it when it was set ≥ 4 h before that wake and the template is unchanged.
 */
export function plannedWake(ctx: DayContext, date: string): { wake: string; base: string } {
  const tpl = templateFor(ctx, date);
  const base = resolveDay(tpl, ctx.blocks, { attending: ctx.dayPlans[date]?.attending }).targetWake;
  return {
    wake: planFor(ctx, date).wake.toISOString(),
    base: zonedInstant(date, parseHHMM(base), ctx.timezone).toISOString(),
  };
}

/**
 * The wake-day containing `now`: a day runs wake → next wake (CLAUDE.md "Time").
 * Before today's wake it's still yesterday's day. `pinned` (date → wake target as pressed, else
 * as frozen by the server) wins over the live plan, as on the server (`_wake_day`, R-M9-R2-1).
 */
export function currentDayDate(
  ctx: DayContext,
  now: Date,
  pinned?: Record<string, string>,
  /** Dates with an "I'm up": that day has started, even before its target (playtest R1 P2). */
  pressed?: ReadonlySet<string>,
): string {
  const d0 = localDate(now, ctx.timezone);
  if (pressed?.has(d0)) return d0;
  const pin = pinned?.[d0];
  const wake = pin ? new Date(pin) : planFor(ctx, d0).wake;
  return now.getTime() < wake.getTime() ? addDays(d0, -1) : d0;
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
  /** Fixed events with their label source (`title`, else i18n `fixedEvents.<key>`). */
  fixedEvents: (DayPlan["fixedEvents"][number] & { key: string; title: string | null })[];
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
    fixedEvents: today.fixedEvents.map((e) => {
      const src = [
        ...templateFor(ctx, date).fixed_events,
        ...(ctx.dayPlans[date]?.overrides.fixed_events ?? []),
      ].find((x) => x.id === e.id);
      return { ...e, key: src?.key ?? "class", title: src?.title ?? null };
    }),
    warnings: [
      ...today.warnings,
      ...tonight.warnings.filter((w) => w.type === "short_sleep" || w.type === "bedtime_drift"),
    ],
    mode: ctx.dayPlans[date]?.mode ?? "normal",
    planned: tonight.planned,
  };
}

/**
 * Blocks that got no time today (the engine squeezed them to 0 min, e.g. Focus between a late
 * wake and a fixed work start). They can't be done, so they're set aside as planned deviations
 * instead of judged as missed (playtest R1 P1).
 */
export function emptyBlocks(t: Timeline): TimelineBlock[] {
  return t.blocks.filter((b) => b.end.getTime() <= b.start.getTime());
}

export function currentBlock(t: Timeline, now: Date): TimelineBlock | undefined {
  return t.blocks.find((b) => b.start.getTime() <= now.getTime() && now.getTime() < b.end.getTime());
}

export { ON_TIME_MIN };

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
  /** Targets the server froze after a late edit (wake_snapshots): what "I'm up" is judged by. */
  frozen: Record<string, string> = {},
): { date: string; target: Date; event: W | null; canPress: boolean } | null {
  const calDate = localDate(now, ctx.timezone);
  const target = frozen[calDate] ? new Date(frozen[calDate]) : planFor(ctx, calDate).wake;
  if (now.getTime() >= target.getTime() - WAKE_EARLY_MS) {
    return { date: calDate, target, event: wakes[calDate] ?? null, canPress: !wakes[calDate] };
  }
  const prev = wakes[dayDate];
  const prevTarget = frozen[dayDate] ? new Date(frozen[dayDate]) : planFor(ctx, dayDate).wake;
  return prev ? { date: dayDate, target: prevTarget, event: prev, canPress: false } : null;
}
