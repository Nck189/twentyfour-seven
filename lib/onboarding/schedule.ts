import { localParts } from "@/lib/time";

/** A weekly fixed slot (class, work…) in local "HH:MM". */
export type WeekEvent = { title: string; start: string; end: string };
export type Week = Partial<Record<number, WeekEvent[]>>; // ISO weekday 1=Mon..7=Sun
export type Kind = { weekdays: number[]; events: WeekEvent[] };

const sig = (events: WeekEvent[]) =>
  JSON.stringify([...events].sort((a, b) => (a.start + a.title).localeCompare(b.start + b.title)));

/**
 * Weekdays with the same schedule become one kind of day (days without events share one kind,
 * listed last). Events are kept sorted by start time.
 */
export function groupWeek(week: Week): Kind[] {
  const groups = new Map<string, Kind>();
  for (let d = 1; d <= 7; d++) {
    const events = [...(week[d] ?? [])].sort((a, b) => (a.start + a.title).localeCompare(b.start + b.title));
    const key = events.length ? sig(events) : "";
    const g = groups.get(key) ?? { weekdays: [], events };
    g.weekdays.push(d);
    groups.set(key, g);
  }
  const busy = [...groups.entries()].filter(([k]) => k !== "").map(([, g]) => g);
  const free = groups.get("");
  return free ? [...busy, free] : busy;
}

const BYDAY: Record<string, number> = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 7 };
const pad = (n: number) => String(n).padStart(2, "0");

/** DTSTART/DTEND value → local weekday + "HH:MM"; null for all-day dates. */
function localOf(prop: string, value: string, tz: string): { weekday: number; hhmm: string } | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value.trim());
  if (!m || /VALUE=DATE(?!-TIME)/.test(prop)) return null;
  const [, y, mo, d, h, mi, , z] = m;
  if (z) {
    const p = localParts(new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi)), tz);
    const wd = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
    return { weekday: wd === 0 ? 7 : wd, hhmm: `${pad(p.hour)}:${pad(p.minute)}` };
  }
  // TZID=… or floating time: read as local wall-clock time.
  const wd = new Date(Date.UTC(+y, +mo - 1, +d)).getUTCDay();
  return { weekday: wd === 0 ? 7 : wd, hhmm: `${h}:${mi}` };
}

/**
 * Reads weekly slots from an .ics export (university timetable, Google Calendar…). Weekly
 * RRULEs count; one-off events count only when the same weekday + time repeats (an expanded
 * export). All-day events are ignored.
 */
export function parseIcs(text: string, tz: string): Week {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n");
  const weekly: { days: number[]; ev: WeekEvent }[] = [];
  const singles = new Map<string, { day: number; ev: WeekEvent; n: number }>();
  let cur: Record<string, { prop: string; value: string }> | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT" && cur) {
      const s = cur.DTSTART && localOf(cur.DTSTART.prop, cur.DTSTART.value, tz);
      const e = cur.DTEND && localOf(cur.DTEND.prop, cur.DTEND.value, tz);
      if (s && e) {
        const ev = {
          title: (cur.SUMMARY?.value ?? "").replace(/\\,/g, ",").trim(),
          start: s.hhmm,
          end: e.hhmm,
        };
        const rrule = cur.RRULE?.value ?? "";
        if (/FREQ=WEEKLY/.test(rrule)) {
          const by = /BYDAY=([A-Z,]+)/.exec(rrule)?.[1];
          const days = by
            ? by
                .split(",")
                .map((x) => BYDAY[x.slice(-2)])
                .filter(Boolean)
            : [s.weekday];
          weekly.push({ days, ev });
        } else if (!rrule) {
          const k = `${s.weekday}|${ev.title}|${ev.start}|${ev.end}`;
          const prev = singles.get(k);
          singles.set(k, { day: s.weekday, ev, n: (prev?.n ?? 0) + 1 });
        }
      }
      cur = null;
    } else if (cur) {
      const i = line.indexOf(":");
      if (i > 0) {
        const prop = line.slice(0, i);
        const name = prop.split(";")[0];
        cur[name] = { prop, value: line.slice(i + 1) };
      }
    }
  }

  const week: Week = {};
  const add = (day: number, ev: WeekEvent) => {
    const list = (week[day] ??= []);
    if (!list.some((x) => x.title === ev.title && x.start === ev.start && x.end === ev.end)) list.push(ev);
  };
  for (const w of weekly) for (const d of w.days) add(d, w.ev);
  for (const s of singles.values()) if (s.n >= 2) add(s.day, s.ev);
  for (const d of Object.keys(week)) week[+d]!.sort((a, b) => a.start.localeCompare(b.start));
  return week;
}
