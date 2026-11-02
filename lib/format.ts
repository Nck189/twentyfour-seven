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
