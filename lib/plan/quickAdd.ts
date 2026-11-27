import { addDays, isoWeekday } from "@/lib/time";
import { MONTHS } from "./months";

/**
 * G2 (Minnie OK 2026-11-27): an appointment typed the moment it comes up, in plain Thai or English
 * ("พรุ่งนี้ บ่าย 2 หมอฟัน", "Fri 3pm dentist", "5/12 10:00-11:30 interview"). Pure: the caller
 * shows the result for a one-tap confirm, so a wrong guess is visible before it's saved.
 *
 * - Date: today/tonight/tomorrow/tmr, the day after (มะรืน), a weekday (the next one, today
 *   included; "next"/"หน้า" = strictly after today), d/m, "24 Dec", "Dec 24", "24 ธ.ค.". No date =
 *   today. A date already past this year means next year.
 * - Time: 24 h (15:00, 15.00, 15.30 น.), am/pm, ranges (10:00-11:30, 3-4pm, บ่าย 2-4), and Thai
 *   clock words: N โมงเช้า, บ่าย N, บ่ายโมง, N โมงเย็น, N ทุ่ม, ตี N, เที่ยง, เที่ยงคืน, "ครึ่ง" = :30.
 *   A bare "N โมง" is colloquial: 1–6 → afternoon, 7–12 → as said.
 * - No time → null (an appointment needs a start).
 * - Title: whatever is left.
 */
export type QuickAdd = { date: string; start: string; end: string | null; title: string };

const EN_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const EN_DAY_RE =
  "(mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)";
const TH_DAYS = ["จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์", "อาทิตย์"];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const byLength = (keys: string[]) =>
  [...keys]
    .sort((a, b) => b.length - a.length)
    .map(esc)
    .join("|");
const MONTH_KEYS = Object.keys(MONTHS);
const EN_MONTH_RE = `(${byLength(MONTH_KEYS.filter((k) => /^[a-z]/.test(k)))})`;
const TH_MONTH_RE = `(${byLength(MONTH_KEYS.filter((k) => !/^[a-z]/.test(k)))})`;

const pad = (n: number) => String(n).padStart(2, "0");
const hm = (h: number, m = 0): string | null =>
  h >= 0 && h <= 24 && m >= 0 && m < 60 ? `${pad(h % 24)}:${pad(m)}` : null;
const half = (s: string | undefined) => (s ? 30 : 0);

/**
 * Weekday 1 (Mon) … 7 (Sun): the next one on/after today; with `nextWeek` ("next fri", "ศุกร์หน้า")
 * the one in next (ISO) week, as Thai speakers mean it (G7 G S2-5).
 */
function nextWeekday(today: string, iso: number, nextWeek: boolean): string {
  if (nextWeek) return addDays(today, 8 - isoWeekday(today) + iso - 1);
  return addDays(today, (iso - isoWeekday(today) + 7) % 7);
}

/** Day N of the month: this month if it hasn't passed, else next month. */
function dayOfMonth(today: string, n: number): string | null {
  if (n < 1 || n > 31) return null;
  let [y, m] = today.split("-").map(Number) as [number, number];
  // This month if the day hasn't passed (and exists), else the next month that has it ("31").
  for (let i = 0; i < 13; i++) {
    const date = `${y}-${pad(m)}-${pad(n)}`;
    const real = new Date(`${date}T00:00:00Z`).getUTCMonth() + 1 === m;
    if (real && date >= today) return date;
    [y, m] = m === 12 ? [y + 1, 1] : [y, m + 1];
  }
  return null;
}

/** A day/month this year, or next year if it has passed. */
function dayMonth(today: string, day: number, month: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const year = Number(today.slice(0, 4));
  const d = `${year}-${pad(month)}-${pad(day)}`;
  // Reject impossible dates like 31/2.
  const t = new Date(`${d}T00:00:00Z`);
  if (t.getUTCMonth() + 1 !== month) return null;
  return d < today ? `${year + 1}-${pad(month)}-${pad(day)}` : d;
}

type Times = { start: string; end: string | null };
type Rule<T> = { re: RegExp; read: (m: RegExpMatchArray) => T | null };

const pm = (h: number, ap: string) => (ap.toLowerCase() === "pm" ? (h % 12) + 12 : h % 12);
/** Bare "N โมง": 1–6 means the afternoon in everyday Thai. */
const thaiMong = (n: number) => (n >= 1 && n <= 6 ? n + 12 : n);

/** "11-1pm": a range's first time takes the second's am/pm, unless that makes it end first. */
function rangeAmPm(h1: number, m1: number, ap1: string | undefined, h2: number, m2: number, ap2: string) {
  const end = hm(pm(h2, ap2), m2);
  let start = hm(pm(h1, ap1 ?? ap2), m1);
  if (!ap1 && start && end && start > end) start = hm(pm(h1, ap2.toLowerCase() === "pm" ? "am" : "pm"), m1);
  return both(start, end);
}

const TIME_RULES: Rule<Times>[] = [
  // Ranges first; am/pm before plain 24 h, so "8:00pm" isn't read as 08:00 (G7 G S2-1/2).
  {
    re: /\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*[-–]\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/i,
    read: (m) => rangeAmPm(+m[1]!, +(m[2] ?? 0), m[3], +m[4]!, +(m[5] ?? 0), m[6]!),
  },
  {
    re: /(\d{1,2})[:.](\d{2})\s*[-–]\s*(\d{1,2})[:.](\d{2})(?:\s*น\.)?/,
    read: (m) => both(hm(+m[1]!, +m[2]!), hm(+m[3]!, +m[4]!)),
  },
  {
    re: /บ่าย\s*(\d{1,2})\s*[-–]\s*(\d{1,2})(?:\s*โมง)?/,
    read: (m) => both(hm(+m[1]! + 12), hm(+m[2]! + 12)),
  },
  // One time.
  { re: /\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/i, read: (m) => one(hm(pm(+m[1]!, m[3]!), +(m[2] ?? 0))) },
  { re: /เที่ยงคืน/, read: () => one(hm(0)) },
  { re: /เที่ยง(?:วัน)?(\s*ครึ่ง)?/, read: (m) => one(hm(12, half(m[1]))) },
  { re: /บ่ายโมง(\s*ครึ่ง)?/, read: (m) => one(hm(13, half(m[1]))) },
  { re: /บ่าย\s*(\d{1,2})(?:\s*โมง)?(\s*ครึ่ง)?/, read: (m) => one(hm(+m[1]! + 12, half(m[2]))) },
  { re: /(\d{1,2})\s*โมงเช้า(\s*ครึ่ง)?/, read: (m) => one(hm(+m[1]!, half(m[2]))) },
  { re: /(\d{1,2})\s*โมงเย็น(\s*ครึ่ง)?/, read: (m) => one(hm((+m[1]! % 12) + 12, half(m[2]))) },
  { re: /(\d{1,2})\s*ทุ่ม(\s*ครึ่ง)?/, read: (m) => one(hm(+m[1]! + 18, half(m[2]))) },
  // ตี 12 is midnight (G7 G S3).
  { re: /ตี\s*(\d{1,2})(\s*ครึ่ง)?/, read: (m) => one(hm(+m[1]! % 12, half(m[2]))) },
  { re: /(\d{1,2})\s*โมง(\s*ครึ่ง)?/, read: (m) => one(hm(thaiMong(+m[1]!), half(m[2]))) },
  { re: /(\d{1,2})[:.](\d{2})(?:\s*น\.)?/, read: (m) => one(hm(+m[1]!, +m[2]!)) },
];
function one(start: string | null): Times | null {
  return start ? { start, end: null } : null;
}
function both(start: string | null, end: string | null): Times | null {
  return start && end ? { start, end } : null;
}

function dateRules(today: string): Rule<string>[] {
  return [
    { re: /\b(?:today|tonight)\b|วันนี้|คืนนี้/i, read: () => today },
    { re: /\b(?:tomorrow|tmrw?|tomorow)\b|พรุ่งนี้/i, read: () => addDays(today, 1) },
    { re: /มะรืน(?:นี้)?|\bday after tomorrow\b/i, read: () => addDays(today, 2) },
    // Day + month first ("8 ธันวาคม", "8 ธค", "24 Dec", "Dec 24"): a month name is never a weekday.
    {
      // Not the start of a longer word ("3 สคริปต์", "2 พยาบาล"; G7 G re-review); "นี้" may follow.
      re: new RegExp(`(\\d{1,2})\\s*${TH_MONTH_RE}(?!(?!นี้)[ก-๙])`),
      read: (m) => dayMonth(today, +m[1]!, MONTHS[m[2]!]!),
    },
    {
      re: new RegExp(`\\b(\\d{1,2})\\s*${EN_MONTH_RE}\\b\\.?`, "i"),
      read: (m) => dayMonth(today, +m[1]!, MONTHS[m[2]!.toLowerCase()]!),
    },
    {
      re: new RegExp(`\\b${EN_MONTH_RE}\\.?\\s*(\\d{1,2})\\b`, "i"),
      read: (m) => dayMonth(today, +m[2]!, MONTHS[m[1]!.toLowerCase()]!),
    },
    {
      re: new RegExp(`\\b(?:(next)\\s+|this\\s+)?${EN_DAY_RE}\\b\\.?`, "i"),
      read: (m) => nextWeekday(today, EN_DAYS.indexOf(m[2]!.slice(0, 3).toLowerCase()) + 1, !!m[1]),
    },
    {
      // "วันจันทร์ที่ 8": the date wins over the weekday name (G7 G re-review).
      re: new RegExp(`(?:วัน)?(?:${TH_DAYS.join("|")})(?:บดี)?\\s*ที่\\s*(\\d{1,2})(?!\\d)`),
      read: (m) => dayOfMonth(today, +m[1]!),
    },
    {
      // Thai is written without spaces, so "ประชุมศุกร์" is Friday; only พระจันทร์/พระอาทิตย์
      // (the moon, the sun) aren't days (G7 G S3 + re-review).
      re: new RegExp(`(?<!พระ)(?:วัน)?(${TH_DAYS.join("|")})(?:บดี)?(?:\\s*(หน้า|นี้))?`),
      read: (m) => nextWeekday(today, TH_DAYS.indexOf(m[1]!) + 1, m[2] === "หน้า"),
    },
    { re: /\b(\d{1,2})\/(\d{1,2})\b/, read: (m) => dayMonth(today, +m[1]!, +m[2]!) },
    // "วันที่ 8", "ที่ 8": the next 8th (not followed by a clock word).
    {
      // Only "วันที่ N", or "ที่ N" standing alone: "บทที่ 5", "ข้อที่ 4", "ครั้งที่ 2" are ordinals
      // (G7 G re-review). The number can't be cut short ("ที่ 10 โมง").
      re: /(?:วันที่|(?<![ก-๙])ที่)\s*(\d{1,2})(?!\d)(?!\s*(?:โมง|ทุ่ม|[:.]\d|น\.))/,
      read: (m) => dayOfMonth(today, +m[1]!),
    },
  ];
}

/** Finds the first rule that matches, and blanks out what it used. */
function take<T>(text: string, rules: Rule<T>[]): { value: T | null; rest: string } {
  for (const r of rules) {
    const m = text.match(r.re);
    if (!m || m.index === undefined) continue;
    const value = r.read(m);
    if (value === null) continue;
    return { value, rest: `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}` };
  }
  return { value: null, rest: text };
}

/** Like parseQuickAdd, and says whether a date was written (`dateGiven`). */
export function parseQuickAddDetail(
  input: string,
  today: string,
  defaultDate: string = today,
): (QuickAdd & { dateGiven: boolean }) | null {
  const text = input.replace(/\s+/g, " ").trim();
  if (!text) return null;
  // Dates first: "5/12" and "24 Dec" contain numbers a time rule would otherwise take.
  const d = take(text, dateRules(today));
  const t = take(d.rest, TIME_RULES);
  if (!t.value) return null;
  const title = t.rest
    .replace(/(^|\s)(?:at|on|@|เวลา|ตอน|วัน)(?=\s|$)/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:–-]+|[\s,;:–-]+$/g, "")
    .trim();
  return {
    date: d.value ?? defaultDate,
    start: t.value.start,
    end: t.value.end,
    title,
    dateGiven: !!d.value,
  };
}

/** An end an hour after `start` ("HH:MM"), past midnight if need be: never the start itself (G7 G S2-3). */
export function endAfter(start: string): string {
  const [h, m] = start.split(":").map(Number) as [number, number];
  const t = (h * 60 + m + 60) % 1440;
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}

/** `defaultDate`: the day meant when none is written (today; tomorrow in the Night ritual). */
export function parseQuickAdd(input: string, today: string, defaultDate: string = today): QuickAdd | null {
  const r = parseQuickAddDetail(input, today, defaultDate);
  return r && { date: r.date, start: r.start, end: r.end, title: r.title };
}
