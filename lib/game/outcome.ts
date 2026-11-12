import { BLOCK_KEYS, type BlockKey } from "@/content/blocks";
import { ON_TIME_MIN, PERFECT_DAY_OEE, SUCCESS_CHECKLIST_RATE } from "@/content/game";

/** The block_logs fields the farm reads (one row per date × block). */
export type GameLog = {
  planned_start: string | null;
  started_at: string | null;
  first10_at: string | null;
  items_done: unknown[];
  items_planned: number;
  location: "home" | "out" | null;
  backfilled: boolean;
  planned_deviation: boolean;
  miss_reason: string | null;
};

export type DayMode = "normal" | "vacation" | "sick";

/** Everything the farm needs to know about one wake-day (wake → next wake). */
export type DayFacts = {
  /** Local wake-day, YYYY-MM-DD. */
  date: string;
  mode: DayMode;
  logs: Partial<Record<BlockKey, GameLog>>;
  /** "I'm up" pressed live inside the window (wake_events.in_window, not backfilled). */
  wakeInWindow: boolean;
  /** This day's Night ritual (planning the next day) was completed. */
  nightRitualDone: boolean;
  exercised: boolean;
  /**
   * Blocks not judged yet (in progress or still ahead, i.e. today): a success there already
   * counts, nothing else does. Omit for finished days.
   */
  open?: BlockKey[];
  /**
   * Blocks a planned deviation covers that day (a planned late night excuses that evening's
   * Free): a miss there is excused, a success still counts (SPEC §3, §8.4).
   */
  excused?: BlockKey[];
  /** Blocks set to have no first-10 that day: left out of the first-10 rate. */
  noFirst10?: BlockKey[];
  /**
   * A finished day with nothing logged at all (no wake, block, ritual or workout): the person was
   * away, so the farm pauses like Vacation (playtest R1 R2, Minnie OK 2026-11-11).
   */
  away?: boolean;
};

/**
 * How a block went for the farm (SPEC §8.1, §8.4):
 * - success: on-time start or checklist ≥ 70% → the crop grows
 * - partial: done, but late and under 70% → no growth, no penalty
 * - miss: skipped (no check-in, or a miss reason) → weeds, then wilt/death
 * - excused: Vacation/Sick day or a planned deviation → no growth, no penalty, streak paused
 * - backfilled: logged after the fact → no growth or mutations, but not a miss
 * - open: today, not over yet → nothing (unless it's already a success)
 */
export type BlockResult = "success" | "partial" | "miss" | "excused" | "backfilled" | "open";

export function checklistRate(log: GameLog): number | null {
  if (log.items_planned <= 0) return null;
  return Math.min(1, log.items_done.length / log.items_planned);
}

export function startedOnTime(log: GameLog): boolean {
  if (log.backfilled || !log.planned_start || !log.started_at) return false;
  const diff = Math.abs(Date.parse(log.started_at) - Date.parse(log.planned_start));
  return Number.isFinite(diff) && diff <= ON_TIME_MIN * 60_000;
}

/** First-10 done live (a backfilled first-10 earns nothing, like tickets). */
export function first10Done(log: GameLog | undefined): boolean {
  return !!log && !log.backfilled && !!log.first10_at;
}

/**
 * The block's start counts (playtest R1, Minnie OK 2026-11-11): started on time, or its first-10
 * was done live once the block had begun — doing the first 10 minutes *is* starting it, even if
 * "Start" wasn't tapped at the planned time. Mirrored in SQL (`_start_counts`).
 */
export function startCounts(log: GameLog): boolean {
  if (startedOnTime(log)) return true;
  if (log.backfilled || !log.first10_at || !log.planned_start) return false;
  return Date.parse(log.first10_at) >= Date.parse(log.planned_start) - ON_TIME_MIN * 60_000;
}

function succeeded(log: GameLog): boolean {
  const rate = checklistRate(log);
  return startCounts(log) || (rate !== null && rate >= SUCCESS_CHECKLIST_RATE);
}

/**
 * Lived actions that count as a block's on-time start (playtest R1, Minnie 2026-11-11): an
 * in-window "I'm up" is Wake's, the Night ritual done in time is Down Time's. (Sleep is started
 * by Goodnight / "Going to bed" itself.) Mirrored in SQL (`_plot_ripe`, `_day_oee`).
 */
export function credited(day: DayFacts, block: BlockKey): boolean {
  return (block === "wake" && day.wakeInWindow) || (block === "down" && day.nightRitualDone);
}

export function blockResult(day: DayFacts, block: BlockKey): BlockResult {
  const log = day.logs[block];
  if (day.mode !== "normal" || day.away) return "excused";
  if (log?.planned_deviation) return "excused";
  if (log?.miss_reason) return day.excused?.includes(block) ? "excused" : "miss";
  if (credited(day, block)) return "success";
  if (log?.backfilled) return "backfilled";
  if (log && succeeded(log)) return "success";
  if (day.open?.includes(block)) return "open";
  if (day.excused?.includes(block)) return "excused";
  if (log?.started_at) return "partial";
  return "miss";
}

/** Minimum day (SPEC §8.7): "I'm up" within the window + Night ritual done. */
export function isMinimumDay(day: DayFacts): boolean {
  return day.wakeInWindow && day.nightRitualDone;
}

/**
 * Day OEE (SPEC §7) = Availability × Performance × Quality.
 * - Availability: blocks started on time / planned blocks (planned deviations excluded)
 * - Performance: checklist items done / planned (1 when nothing was planned)
 * - Quality: first-10 success rate over the planned blocks that have a first-10
 * Vacation/Sick days have no OEE (null).
 */
export function dayOee(day: DayFacts): {
  availability: number;
  performance: number;
  quality: number;
  oee: number;
} | null {
  if (day.mode !== "normal" || day.away) return null;
  const planned = BLOCK_KEYS.filter((b) => !day.logs[b]?.planned_deviation);
  if (planned.length === 0) return null;
  let onTime = 0;
  let first10 = 0;
  let done = 0;
  let itemsPlanned = 0;
  for (const b of planned) {
    const log = day.logs[b];
    if (credited(day, b) && !log?.miss_reason) onTime++;
    else if (log && startCounts(log)) onTime++;
    if (!log) continue;
    if (first10Done(log) && !day.noFirst10?.includes(b)) first10++;
    if (log.items_planned > 0) {
      itemsPlanned += log.items_planned;
      done += Math.min(log.items_done.length, log.items_planned);
    }
  }
  const withFirst10 = planned.filter((b) => !day.noFirst10?.includes(b)).length;
  const availability = onTime / planned.length;
  const performance = itemsPlanned > 0 ? done / itemsPlanned : 1;
  const quality = withFirst10 > 0 ? first10 / withFirst10 : 1;
  return { availability, performance, quality, oee: availability * performance * quality };
}

/** Perfect day (SPEC §8.7): minimum day + Day OEE ≥ 80%. */
export function isPerfectDay(day: DayFacts): boolean {
  const o = dayOee(day);
  return isMinimumDay(day) && o !== null && o.oee >= PERFECT_DAY_OEE;
}
