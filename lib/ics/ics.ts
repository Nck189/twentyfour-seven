/**
 * The calendar feed (M11, SPEC §9): planned blocks and fixed events as an iCalendar text, pure.
 * Times are UTC (`Z`), so every calendar shows them in its own timezone. Sleep is left out (a
 * night-long event clutters calendars); its start is Down's end.
 */
export type IcsEvent = { uid: string; start: Date; end: Date; summary: string; description?: string };

const stamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

/** RFC 5545 TEXT escaping. */
export const icsText = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");

/** Lines longer than 75 octets are folded (CRLF + space), never inside a UTF-8 character. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > (out.length === 0 ? 75 : 74)) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function buildIcs(events: readonly IcsEvent[], opts: { name: string; now: Date }): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//24-7//Plan//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText(opts.name)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const e of [...events].sort((a, b) => a.start.getTime() - b.start.getTime())) {
    if (!(e.end > e.start)) continue;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${stamp(opts.now)}`,
      `DTSTART:${stamp(e.start)}`,
      `DTEND:${stamp(e.end)}`,
      `SUMMARY:${icsText(e.summary)}`,
      ...(e.description ? [`DESCRIPTION:${icsText(e.description)}`] : []),
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
