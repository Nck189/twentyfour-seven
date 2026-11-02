/**
 * Timezone helpers. All instants are stored as UTC; "days" are computed in the user's
 * timezone (default Asia/Bangkok), never from the server clock's zone.
 */
export const DEFAULT_TZ = "Asia/Bangkok";

export type LocalParts = { year: number; month: number; day: number; hour: number; minute: number };

export function localParts(instant: Date, tz: string = DEFAULT_TZ): LocalParts {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const get = (type: string) => Number(fmt.formatToParts(instant).find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

/** Calendar date (YYYY-MM-DD) of an instant in the given timezone. */
export function localDate(instant: Date, tz: string = DEFAULT_TZ): string {
  const p = localParts(instant, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Offset (minutes, local − UTC) of a timezone at an instant. */
export function tzOffsetMinutes(instant: Date, tz: string = DEFAULT_TZ): number {
  const p = localParts(instant, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  const truncated = Math.floor(instant.getTime() / 60000) * 60000;
  return Math.round((asUtc - truncated) / 60000);
}

/** UTC instant for a local wall-clock time (date YYYY-MM-DD + minutes after local midnight). */
export function zonedInstant(date: string, minutesOfDay: number, tz: string = DEFAULT_TZ): Date {
  const [y, m, d] = date.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, 0, 0) + minutesOfDay * 60000);
  // Two-pass correction handles zones with DST.
  let t = guess.getTime() - tzOffsetMinutes(guess, tz) * 60000;
  t = guess.getTime() - tzOffsetMinutes(new Date(t), tz) * 60000;
  return new Date(t);
}

/** Add whole days to a YYYY-MM-DD date string (calendar arithmetic, zone-free). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** ISO weekday 1=Mon … 7=Sun for a YYYY-MM-DD date. */
export function isoWeekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}
