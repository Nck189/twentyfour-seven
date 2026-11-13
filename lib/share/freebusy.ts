/**
 * Share availability (M12, SPEC §9): free/busy from the day's plan, pure. "Free" is the Free block
 * minus fixed events (classes, appointments, accepted bookings), from now on, never past local
 * midnight (a slot stays inside one day's plan); everything else is busy. Only times leave the
 * server: no block names, titles or tasks.
 */
import { localDate } from "@/lib/time";

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

/** Local midnight after `d` in `tz` (the end of that calendar day). */
function nextMidnight(d: Date, tz: string): Date {
  const day = localDate(d, tz);
  // Step forward by hours until the local date changes (no DST in most zones, safe in all).
  const t = new Date(d.getTime());
  t.setUTCMinutes(0, 0, 0);
  while (localDate(t, tz) === day) t.setTime(t.getTime() + 60 * 60_000);
  // Back off to the exact minute the date flips.
  while (localDate(new Date(t.getTime() - 60_000), tz) !== day) t.setTime(t.getTime() - 60_000);
  return t;
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
  const midnight = nextMidnight(free.start, tz);
  const end = free.end < midnight ? free.end : midnight;
  if (end <= start) return { date, free: [] };
  const gaps = subtract({ start, end }, fixed).filter(
    (i) => i.end.getTime() - i.start.getTime() >= MIN_FREE_MIN * 60_000,
  );
  return { date, free: gaps };
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
