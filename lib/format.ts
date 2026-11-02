/** Wall-clock "HH:MM" in the user's timezone (24h, as used in Thailand). */
export function formatTime(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

/** Long date like "Monday 2 November" / "วันจันทร์ที่ 2 พฤศจิกายน". */
export function formatDayLong(date: string, locale: string, timeZone: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const noonUtc = new Date(Date.UTC(y, m - 1, d, 5)); // noon in Asia; avoids date flips
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(noonUtc);
}

const noonOf = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 5));
};

/** Full weekday like "Wednesday" / "วันพุธ". */
export function formatWeekdayLong(date: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { timeZone, weekday: "long" }).format(
    noonOf(date),
  );
}

/** Short weekday like "Tue" / "อ." for the week strip. */
export function formatWeekdayShort(date: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { timeZone, weekday: "short" }).format(
    noonOf(date),
  );
}

/** Short date like "6 Nov" / "6 พ.ย." for chips. */
export function formatDayShort(date: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
  }).format(noonOf(date));
}
