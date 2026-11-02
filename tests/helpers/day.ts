import { addDays, localDate, localParts } from "@/lib/time";

/**
 * The wake-day right now when every template wakes at `wakeMin` (default 10:00): a day runs
 * wake → next wake, so before the wake it's still yesterday's day (Plan's "Today").
 */
export function wakeDay(wakeMin = 10 * 60, tz = "Asia/Bangkok"): string {
  const now = new Date();
  const p = localParts(now, tz);
  const cal = localDate(now, tz);
  return p.hour * 60 + p.minute < wakeMin ? addDays(cal, -1) : cal;
}
