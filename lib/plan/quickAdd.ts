import { addDays, isoWeekday } from "@/lib/time";

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
const EN_MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const EN_MONTH_RE =
  "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const TH_MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const TH_MONTH_RE = `(${TH_MONTHS.map(esc).join("|")})`;

const pad = (n: number) => String(n).padStart(2, "0");
const hm = (h: number, m = 0): string | null =>
  h >= 0 && h <= 24 && m >= 0 && m < 60 ? `${pad(h % 24)}:${pad(m)}` : null;
const half = (s: string | undefined) => (s ? 30 : 0);

/** Weekday 1 (Mon) … 7 (Sun): the next one on/after today, or strictly after with `next`. */
function nextWeekday(today: string, iso: number, strictlyAfter: boolean): string {
  const diff = (iso - isoWeekday(today) + 7) % 7;
  return addDays(today, diff === 0 && strictlyAfter ? 7 : diff);
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

const TIME_RULES: Rule<Times>[] = [
  // Ranges first.
  {
    re: /(\d{1,2})[:.](\d{2})\s*[-–]\s*(\d{1,2})[:.](\d{2})(?:\s*น\.)?/,
    read: (m) => both(hm(+m[1]!, +m[2]!), hm(+m[3]!, +m[4]!)),
  },
  {
    re: /\b(\d{1,2})(?::(\d{2}))?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i,
    read: (m) => both(hm(pm(+m[1]!, m[5]!), +(m[2] ?? 0)), hm(pm(+m[3]!, m[5]!), +(m[4] ?? 0))),
  },
  {
    re: /บ่าย\s*(\d{1,2})\s*[-–]\s*(\d{1,2})(?:\s*โมง)?/,
    read: (m) => both(hm(+m[1]! + 12), hm(+m[2]! + 12)),
  },
  // One time.
  { re: /เที่ยงคืน/, read: () => one(hm(0)) },
  { re: /เที่ยง(?:วัน)?(\s*ครึ่ง)?/, read: (m) => one(hm(12, half(m[1]))) },
  { re: /บ่ายโมง(\s*ครึ่ง)?/, read: (m) => one(hm(13, half(m[1]))) },
  { re: /บ่าย\s*(\d{1,2})(?:\s*โมง)?(\s*ครึ่ง)?/, read: (m) => one(hm(+m[1]! + 12, half(m[2]))) },
  { re: /(\d{1,2})\s*โมงเช้า(\s*ครึ่ง)?/, read: (m) => one(hm(+m[1]!, half(m[2]))) },
  { re: /(\d{1,2})\s*โมงเย็น(\s*ครึ่ง)?/, read: (m) => one(hm((+m[1]! % 12) + 12, half(m[2]))) },
  { re: /(\d{1,2})\s*ทุ่ม(\s*ครึ่ง)?/, read: (m) => one(hm(+m[1]! + 18, half(m[2]))) },
  { re: /ตี\s*(\d{1,2})(\s*ครึ่ง)?/, read: (m) => one(hm(+m[1]!, half(m[2]))) },
  { re: /(\d{1,2})\s*โมง(\s*ครึ่ง)?/, read: (m) => one(hm(thaiMong(+m[1]!), half(m[2]))) },
  { re: /(\d{1,2})[:.](\d{2})(?:\s*น\.)?/, read: (m) => one(hm(+m[1]!, +m[2]!)) },
  { re: /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i, read: (m) => one(hm(pm(+m[1]!, m[3]!), +(m[2] ?? 0))) },
  { re: /(\d{1,2})\s*น\./, read: (m) => one(hm(+m[1]!)) },
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
    {
      re: new RegExp(`\\b(next\\s+)?${EN_DAY_RE}\\b`, "i"),
      read: (m) => nextWeekday(today, EN_DAYS.indexOf(m[2]!.slice(0, 3).toLowerCase()) + 1, !!m[1]),
    },
    {
      re: new RegExp(`(?:วัน)?(${TH_DAYS.join("|")})(?:บดี)?(\\s*หน้า)?`),
      read: (m) => nextWeekday(today, TH_DAYS.indexOf(m[1]!) + 1, !!m[2]),
    },
    { re: /\b(\d{1,2})\/(\d{1,2})\b/, read: (m) => dayMonth(today, +m[1]!, +m[2]!) },
    {
      re: new RegExp(`\\b(\\d{1,2})\\s*${EN_MONTH_RE}\\b`, "i"),
      read: (m) => dayMonth(today, +m[1]!, EN_MONTHS.indexOf(m[2]!.slice(0, 3).toLowerCase()) + 1),
    },
    {
      re: new RegExp(`\\b${EN_MONTH_RE}\\s*(\\d{1,2})\\b`, "i"),
      read: (m) => dayMonth(today, +m[2]!, EN_MONTHS.indexOf(m[1]!.slice(0, 3).toLowerCase()) + 1),
    },
    {
      re: new RegExp(`(\\d{1,2})\\s*${TH_MONTH_RE}`),
      read: (m) => dayMonth(today, +m[1]!, TH_MONTHS.indexOf(m[2]!) + 1),
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

/** `defaultDate`: the day meant when none is written (today; tomorrow in the Night ritual). */
export function parseQuickAdd(input: string, today: string, defaultDate: string = today): QuickAdd | null {
  const r = parseQuickAddDetail(input, today, defaultDate);
  return r && { date: r.date, start: r.start, end: r.end, title: r.title };
}
