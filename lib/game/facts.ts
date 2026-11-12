import { BLOCK_KEYS, type BlockKey } from "@/content/blocks";
import { addDays, localDate } from "@/lib/time";
import type { DayFacts, DayMode, GameLog } from "./outcome";

export type LogRow = GameLog & { date: string; block: BlockKey };
export type WakeRow = { date: string; in_window: boolean; backfilled: boolean };

export type FactsInput = {
  /** First wake-day to include (the day before the earliest planting, for its weather). */
  from: string;
  /** The current wake-day: its blocks are still open (judged once the day is over). */
  today: string;
  timezone: string;
  logs: readonly LogRow[];
  /** day_plans.mode by date (missing = normal). */
  modes: Readonly<Record<string, DayMode>>;
  /** Dates D whose day plan has a late night (out late the night before D): D−1's Free is excused. */
  lateNights?: readonly string[];
  wakes: readonly WakeRow[];
  /** Dates whose Night ritual was done in time (the server's `night` ticket grants). */
  nights: readonly string[];
  /** exercise_logs.at timestamps. */
  exercise: readonly string[];
};

/**
 * Turns the rows the farm reads into one DayFacts per wake-day from `from` to `today`
 * (pure; the I/O lives in lib/farm). Only server-judged facts count for the minimum day:
 * a live in-window "I'm up" and a Night ticket.
 */
export function buildDayFacts(i: FactsInput): DayFacts[] {
  const logsByDate = new Map<string, Partial<Record<BlockKey, GameLog>>>();
  for (const l of i.logs) {
    const m = logsByDate.get(l.date) ?? {};
    m[l.block] = l;
    logsByDate.set(l.date, m);
  }
  const wakeOk = new Set(i.wakes.filter((w) => w.in_window && !w.backfilled).map((w) => w.date));
  const nights = new Set(i.nights);
  const anyWake = new Set(i.wakes.map((w) => w.date));
  const lateNights = new Set(i.lateNights ?? []);
  const exercised = new Set(i.exercise.map((at) => localDate(new Date(at), i.timezone)));
  const out: DayFacts[] = [];
  for (let d = i.from; d <= i.today; d = addDays(d, 1)) {
    const away = d < i.today && !logsByDate.has(d) && !anyWake.has(d) && !nights.has(d) && !exercised.has(d);
    out.push({
      date: d,
      mode: i.modes[d] ?? "normal",
      logs: logsByDate.get(d) ?? {},
      wakeInWindow: wakeOk.has(d),
      nightRitualDone: nights.has(d),
      exercised: exercised.has(d),
      ...(d === i.today ? { open: [...BLOCK_KEYS] } : {}),
      ...(lateNights.has(addDays(d, 1)) ? { excused: ["free" as BlockKey] } : {}),
      ...(away ? { away: true } : {}),
    });
  }
  return out;
}
