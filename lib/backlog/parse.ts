import { addDays, isoWeekday } from "@/lib/time";
import type { Priority } from "./index";

/**
 * Quick capture: one line of text → a backlog item. Only short, space-separated tokens are
 * read, so ordinary sentences stay as typed:
 *   30m · 1h · 1.5h · 1h30 · 20น · 2ชม     → estimate
 *   !must !m !1 !ด่วน · !should !s !2 · !just !j !3 → priority
 *   today วันนี้ · tomorrow tmr พรุ่งนี้ · mon…sun · จันทร์…อาทิตย์ (next one) → planned day
 *   due <day> · ส่ง<day> / ส่ง <day>   → deadline
 *   #yop #senior #class #เรียน …        → project tag
 */
export type Capture = {
  title: string;
  estimate_min?: number;
  priority?: Priority;
  scheduled_date?: string;
  deadline?: string;
  tag?: string;
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
  const diff = (wd - isoWeekday(today) + 7) % 7 || 7;
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

export function parseCapture(text: string, today: string): Capture {
  const raw = text.trim().replace(/\s+/g, " ");
  const tokens = raw.split(" ");
  const out: Omit<Capture, "title"> = {};
  const rest: string[] = [];

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
    // Deadline: "due <day>", "ส่ง <day>", or glued "ส่ง<day>".
    if ((tok.toLowerCase() === "due" || tok === "ส่ง") && i + 1 < tokens.length && !out.deadline) {
      const d = dayOf(tokens[i + 1], today);
      if (d) {
        out.deadline = d;
        i++;
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
    const day = dayOf(tok, today);
    if (day && !out.scheduled_date) {
      out.scheduled_date = day;
      continue;
    }
    rest.push(tok);
  }

  const title = rest.join(" ").trim();
  // Only tokens? Keep what was typed as the title instead of guessing.
  if (!title) return { title: raw };
  return { title, ...out };
}
