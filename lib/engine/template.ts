import type { BlockKey, BlockSetting } from "@/content/blocks";
import type { FixedEvent, TemplateDefault } from "@/content/defaults";
import type { FixedEventInput, HHMM } from "./types";

export type TemplateLike = Pick<TemplateDefault, "target_wake" | "options" | "fixed_events"> & {
  blocks?: Partial<Record<BlockKey, Partial<BlockSetting>>>;
};

export type ResolvedDay = {
  targetWake: HHMM;
  durations: Record<BlockKey, number>;
  fixedEvents: FixedEventInput[];
};

const hhmm = (t: string) => t.slice(0, 5);

/**
 * Template + settings + per-day choices → engine inputs.
 * Attend toggle (Thu class): skipping uses the alternate wake and drops the template's fixed events.
 */
export function resolveDay(
  template: TemplateLike,
  blockSettings: Pick<BlockSetting, "key" | "duration_min">[],
  opts: { attending?: boolean | null; extraFixedEvents?: FixedEvent[] } = {},
): ResolvedDay {
  const skipping = Boolean(template.options.attend_toggle) && opts.attending === false;
  const durations = Object.fromEntries(
    blockSettings.map((b) => [b.key, template.blocks?.[b.key]?.duration_min ?? b.duration_min]),
  ) as Record<BlockKey, number>;
  const events = [...(skipping ? [] : template.fixed_events), ...(opts.extraFixedEvents ?? [])];
  return {
    targetWake: hhmm(
      skipping && template.options.alt_target_wake ? template.options.alt_target_wake : template.target_wake,
    ),
    durations,
    fixedEvents: events.map((e) => ({ id: e.id, start: hhmm(e.start), end: hhmm(e.end), host: e.host })),
  };
}

/** The auto-applied template for an ISO weekday (1=Mon..7=Sun). */
export function templateForWeekday<T extends Pick<TemplateDefault, "weekdays" | "auto_apply">>(
  templates: T[],
  isoWeekday: number,
): T | undefined {
  return templates.find((t) => t.auto_apply && t.weekdays.includes(isoWeekday));
}
