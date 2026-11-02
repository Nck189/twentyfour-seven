import type { BlockKey } from "@/content/blocks";

/** Local wall-clock time "HH:MM" (minutes after local midnight once parsed). */
export type HHMM = string;

export type SubSlot = {
  id: string;
  label: string;
  /** Minutes after the host block's start. Moves with the block. */
  offsetMin: number;
  durationMin: number;
  kind?: "gym" | "task" | "other";
};

export type FixedEventInput = {
  id: string;
  start: HHMM;
  end: HHMM;
  /** Block that must contain the event (default: work). */
  host?: BlockKey;
};

export type PlanInput = {
  /** Calendar date D (YYYY-MM-DD) whose wake this plan is for. */
  date: string;
  timezone: string;
  /** Target wake for D after template + attending toggle (HH:MM). */
  targetWake: HHMM;
  /** Target wake of D+1 (snap-back anchor for the end of the day). */
  nextTargetWake: HHMM;
  /** Desired block durations (minutes) for D. */
  durations: Record<BlockKey, number>;
  /** Sleep duration used to derive D+1's target bedtime (defaults to durations.sleep). */
  nextSleepMin?: number;
  fixedEvents?: FixedEventInput[];
  subSlots?: Partial<Record<BlockKey, SubSlot[]>>;
  /** Bedtime the night before D (instant). Omit = template target. */
  bedtimeOverride?: Date;
  /** "Out late tonight": the time you'll be home (instant). Tagged planned. */
  lateNightReturn?: Date;
  /** Explicit next-night bedtime (D+1's override, if already planned). */
  nextBedtimeOverride?: Date;
  /** Gym close time (HH:MM) for the exercise warning. */
  gymClose?: HHMM;
  /** Previous 7 nights' bedtimes (instants) for the drift guardrail. */
  recentBedtimes?: Date[];
};

export type PlannedSubSlot = SubSlot & { start: Date; end: Date; clipped: boolean };

export type PlannedBlock = {
  key: BlockKey;
  start: Date;
  end: Date;
  durationMin: number;
  desiredMin: number;
  compressedMin: number;
  subSlots: PlannedSubSlot[];
};

export type PlannedFixedEvent = { id: string; start: Date; end: Date; host: BlockKey };

export type Warning =
  | { type: "short_sleep"; sleepMin: number; desiredMin: number }
  | { type: "fixed_event_conflict"; eventId: string; lateByMin: number }
  | { type: "gym_after_close"; slotId: string; endsAt: Date }
  | { type: "bedtime_drift"; deltaMin: number }
  | { type: "day_overfull"; shortByMin: number };

export type DayPlan = {
  date: string;
  bedtime: Date;
  wake: Date;
  nextBedtime: Date;
  /** Down (night before D), Sleep, Wake, Focus, Work, Gradation, Free. */
  blocks: PlannedBlock[];
  fixedEvents: PlannedFixedEvent[];
  warnings: Warning[];
  /** True when the night is a planned deviation (late-night mode): never a miss. */
  planned: boolean;
  /** Minutes the bedtime moved vs the template target (+ later). */
  pushMin: number;
};
