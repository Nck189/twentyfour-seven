/**
 * Share availability (M12, SPEC §9): free/busy from the day's plan, pure. "Free" is the Free block
 * minus fixed events (classes, appointments, accepted bookings), from now on, never past local
 * midnight (a slot stays inside one day's plan); everything else is busy. Only times leave the
 * server: no block names, titles or tasks.
 */
import { addDays, zonedInstant } from "@/lib/time";

export type Interval = { start: Date; end: Date };
export type DayFree = { date: string; free: Interval[] };

/** Gaps shorter than this aren't offered. */
export const MIN_FREE_MIN = 30;
/** How far ahead a share link shows. */
export const SHARE_DAYS = 14;

export function subtract(base: Interval, cuts: readonly Interval[]): Interval[] {
  let out: Interval[] = [base];
  for (const c of cuts) {
    const next: Interval[] = [];
    for (const i of out) {
      if (c.end <= i.start || c.start >= i.end) {
        next.push(i);
        continue;
      }
      if (c.start > i.start) next.push({ start: i.start, end: c.start });
      if (c.end < i.end) next.push({ start: c.end, end: i.end });
    }
    out = next;
  }
  return out;
}

export function freeForDay(input: {
  date: string;
  /** The day's Free block (null if the day has none). */
  free: Interval | null;
  /** Fixed events of that day (busy). */
  fixed: readonly Interval[];
  now: Date;
  tz: string;
}): DayFree {
  const { date, free, fixed, now, tz } = input;
  if (!free) return { date, free: [] };
  const start = free.start > now ? free.start : now;
  // The midnight that ends the wake-day's calendar date: a fixed event's HH:MM is read on that
  // date, so time after it can't become a booking on this day (G7 R-M12-2).
  const midnight = zonedInstant(addDays(date, 1), 0, tz);
  const end = free.end < midnight ? free.end : midnight;
  if (end <= start) return { date, free: [] };
  const gaps = subtract({ start, end }, fixed).filter(
    (i) => i.end.getTime() - i.start.getTime() >= MIN_FREE_MIN * 60_000,
  );
  return { date, free: gaps };
}

/** The wake-day whose free time holds the whole slot, or null (the server checks every request). */
export function slotFits(days: readonly DayFree[], start: Date, end: Date): string | null {
  for (const d of days) for (const i of d.free) if (start >= i.start && end <= i.end) return d.date;
  return null;
}

/** "Copy free slots" as plain text for LINE: one line per day with its free times. */
export function slotsText(
  days: readonly DayFree[],
  fmt: { day: (date: string) => string; time: (d: Date) => string; title: string; none: string },
): string {
  const lines = days
    .filter((d) => d.free.length > 0)
    .map(
      (d) => `${fmt.day(d.date)}: ${d.free.map((i) => `${fmt.time(i.start)}–${fmt.time(i.end)}`).join(", ")}`,
    );
  return [fmt.title, ...(lines.length ? lines : [fmt.none])].join("\n");
}
