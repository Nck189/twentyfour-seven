import { addDays, isoWeekday } from "@/lib/time";
import { MONTHS } from "@/lib/plan/months";
import { endAfter, parseQuickAddDetail } from "@/lib/plan/quickAdd";
import type { Priority } from "./index";

/**
 * Quick capture: one line of text → a backlog item. Only short, space-separated tokens are
 * read, so ordinary sentences stay as typed:
 *   30m · 1h · 1.5h · 1h30 · 20น · 2ชม     → estimate
 *   !must !m !1 !ด่วน · !should !s !2 · !just !j !3 → priority
 *   today วันนี้ · tomorrow tmr พรุ่งนี้ · mon…sun · จันทร์…อาทิตย์ (the next one; the same weekday = today) → planned day
 *   due <day> · ส่ง<day> / ส่ง <day>   → deadline
 *   #yop #senior #class #เรียน …        → project tag
 *   30/11 · 15/3/2027 · 15 มี.ค. · mar 15 (+ a time 14:00 · 2pm · 13:00-16:00) → appointment;
 *   a date without a time plans the task that day
 */
export type Capture = {
  title: string;
  estimate_min?: number;
  priority?: Priority;
  scheduled_date?: string;
  deadline?: string;
  tag?: string;
  /** A date + time → an appointment that day (any distance ahead), not a task. */
  appointment?: { date: string; start: string; end: string };
};

const PRIORITY: Record<string, Priority> = {
  must: "must",
  m: "must",
  "1": "must",
  ด่วน: "must",
  should: "should",
  s: "should",
  "2": "should",
  just: "just_start",
  j: "just_start",
  "3": "just_start",
};

/** Tag aliases (key → words that pick it, lower case, matched by prefix of 3+ letters). */
const TAG_ALIASES: Record<string, string[]> = {
  yop: ["yop"],
  senior_project: ["senior_project", "senior", "project"],
  class: ["class", "เรียน"],
  personal: ["personal", "ส่วนตัว"],
  family: ["family", "ครอบครัว"],
  health: ["health", "สุขภาพ"],
};

const WEEKDAYS: Record<string, number> = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  sun: 7,
  จันทร์: 1,
  อังคาร: 2,
  พุธ: 3,
  พฤหัส: 4,
  พฤหัสบดี: 4,
  ศุกร์: 5,
  เสาร์: 6,
  อาทิตย์: 7,
};

/** A day word → YYYY-MM-DD, or null. Weekdays mean the next one after today. */
function dayOf(word: string, today: string): string | null {
  const w = word.toLowerCase().replace(/^วัน(?=.)/, "");
  if (w === "today" || w === "นี้" || word === "วันนี้") return today;
  if (w === "tomorrow" || w === "tmr" || word === "พรุ่งนี้") return addDays(today, 1);
  const wd = WEEKDAYS[w];
  if (!wd) return null;
  const diff = (wd - isoWeekday(today) + 7) % 7; // the same weekday = today
  return addDays(today, diff);
}

function estimateOf(token: string): number | null {
  const t = token.toLowerCase();
  let m = /^(\d+)h(\d{1,2})$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /^(\d+(?:\.\d+)?)(m|min|mins|น|นาที)$/.exec(t);
  if (m) return Math.round(Number(m[1]));
  m = /^(\d+(?:\.\d+)?)(h|hr|hrs|ชม\.?|ชั่วโมง)$/.exec(t);
  if (m) return Math.round(Number(m[1]) * 60);
  return null;
}

function tagOf(token: string): string | null {
  if (!token.startsWith("#") || token.length < 4) return null;
  const word = token.slice(1).toLowerCase();
  for (const [key, aliases] of Object.entries(TAG_ALIASES)) {
    if (aliases.some((a) => a.startsWith(word) || word === a)) return key;
  }
  return null;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

const daysIn = (year: number, m: number) => new Date(Date.UTC(year, m, 0)).getUTCDate();

/**
 * d/m with an optional year → YYYY-MM-DD. No year → the next time that date comes round
 * (today or later; 29/2 waits for a leap year).
 */
function resolveDate(d: number, m: number, y: number | null, today: string): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  if (y !== null) {
    // Buddhist era (2569 → 2026); two digits: 27 → 2027, but 70 → พ.ศ. 2570 = 2027 (Thai style).
    const thisYear = Number(today.slice(0, 4));
    const year = y > 2400 ? y - 543 : y < 100 ? (2000 + y > thisYear + 10 ? 2500 + y - 543 : 2000 + y) : y;
    return d > daysIn(year, m) ? null : `${year}-${pad2(m)}-${pad2(d)}`;
  }
  const start = Number(today.slice(0, 4));
  for (let year = start; year <= start + 8; year++) {
    const iso = `${year}-${pad2(m)}-${pad2(d)}`;
    if (d <= daysIn(year, m) && iso >= today) return iso;
  }
  return null;
}

/** A date starting at token i: day words, d/m[/y], "15 mar", "mar 15", "15 มี.ค.". */
function readDate(tokens: string[], i: number, today: string): { date: string; len: number } | null {
  const t = tokens[i];
  if (t === undefined) return null;
  const word = dayOf(t, today);
  if (word) return { date: word, len: 1 };
  const slash = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(t);
  if (slash) {
    const date = resolveDate(+slash[1], +slash[2], slash[3] ? +slash[3] : null, today);
    return date ? { date, len: 1 } : null;
  }
  const next = tokens[i + 1];
  if (next === undefined) return null;
  const mNext = MONTHS[next.toLowerCase()];
  if (/^\d{1,2}$/.test(t) && mNext) {
    const date = resolveDate(+t, mNext, null, today);
    return date ? { date, len: 2 } : null;
  }
  const mHere = MONTHS[t.toLowerCase()];
  if (mHere && /^\d{1,2}$/.test(next)) {
    const date = resolveDate(+next, mHere, null, today);
    return date ? { date, len: 2 } : null;
  }
  return null;
}

/** "14:00", "18.30", "2pm", "10:30am", or a range "13:00-16:00" → start (and end). */
function readTime(token: string): { start: string; end?: string } | null {
  const one = (x: string): string | null => {
    const m = /^(\d{1,2})(?:[:.](\d{2}))?(am|pm)?$/i.exec(x);
    if (!m || (!m[2] && !m[3])) return null;
    let h = Number(m[1]);
    const min = Number(m[2] ?? 0);
    const ap = m[3]?.toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    if (h > 23 || min > 59) return null;
    return `${pad2(h)}:${pad2(min)}`;
  };
  const range = /^(.+?)[-–](.+)$/.exec(token);
  if (range) {
    const a = one(range[1]);
    const b = one(range[2]);
    return a && b ? { start: a, end: b } : null;
  }
  const s = one(token);
  return s ? { start: s } : null;
}

export function parseCapture(text: string, today: string): Capture {
  const raw = text.trim().replace(/\s+/g, " ");
  const tokens = raw.split(" ");
  const out: Omit<Capture, "title"> = {};
  const keep: string[] = [];
  let date: string | null = null;
  let time: { start: string; end?: string; index: number } | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const est = estimateOf(tok);
    if (est !== null && est > 0 && est <= 1440 && out.estimate_min === undefined) {
      out.estimate_min = est;
      continue;
    }
    if (tok.startsWith("!") && PRIORITY[tok.slice(1).toLowerCase()] && !out.priority) {
      out.priority = PRIORITY[tok.slice(1).toLowerCase()];
      continue;
    }
    const tag = tagOf(tok);
    if (tag && !out.tag) {
      out.tag = tag;
      continue;
    }
    // Deadline: "due <date>", "ส่ง <date>", or glued "ส่ง<day>".
    if ((tok.toLowerCase() === "due" || tok === "ส่ง") && !out.deadline) {
      const d = readDate(tokens, i + 1, today);
      if (d) {
        out.deadline = d.date;
        i += d.len;
        continue;
      }
    }
    if (tok.startsWith("ส่ง") && tok.length > 3 && !out.deadline) {
      const d = dayOf(tok.slice(3), today);
      if (d) {
        out.deadline = d;
        continue;
      }
    }
    if (!date) {
      const d = readDate(tokens, i, today);
      if (d) {
        date = d.date;
        i += d.len - 1;
        continue;
      }
    }
    if (!time) {
      const t = readTime(tok);
      if (t) {
        time = { ...t, index: keep.length };
        keep.push(tok); // stays in the title unless it turns out to be an appointment
        continue;
      }
    }
    keep.push(tok);
  }

  if (date && time) {
    keep.splice(time.index, 1);
    out.appointment = { date, start: time.start, end: time.end ?? endAfter(time.start) };
  } else if (date) {
    out.scheduled_date = date;
  }
  // G2 (2026-11-27): Thai clock words and phrases the token reader can't see ("พรุ่งนี้ บ่าย 2
  // ประชุม", "ศุกร์ 2 ทุ่ม"), read from the words not used yet. Only with a date (written, or read
  // above), like above: a time alone stays a task title. Never on a deadline task (G7 G S2-4).
  if (!out.appointment && !out.deadline) {
    const q = parseQuickAddDetail(keep.join(" "), today, date ?? today);
    if (q && (q.dateGiven || date)) {
      delete out.scheduled_date;
      return {
        title: q.title || raw,
        ...out,
        appointment: { date: q.date, start: q.start, end: q.end ?? endAfter(q.start) },
      };
    }
  }
  const title = keep.join(" ").trim();
  // Only tokens? Keep what was typed as the title instead of guessing; an appointment it read
  // ("sun 9am") stays one, with that as its title (G7 G note).
  if (!title) return out.appointment ? { title: raw, appointment: out.appointment } : { title: raw };
  return { title, ...out };
}
