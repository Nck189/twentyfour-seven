import { describe, expect, it } from "vitest";
import { buildIcs, foldLine, icsText } from "@/lib/ics/ics";

describe("calendar feed (.ics, M11)", () => {
  const now = new Date(Date.UTC(2026, 10, 12, 0, 0, 0));
  it("events in UTC, sorted, escaped; empty or backwards events are left out", () => {
    const ics = buildIcs(
      [
        {
          uid: "2026-11-12-work@247",
          start: new Date(Date.UTC(2026, 10, 12, 2)),
          end: new Date(Date.UTC(2026, 10, 12, 11)),
          summary: "Work",
        },
        {
          uid: "2026-11-12-focus@247",
          start: new Date(Date.UTC(2026, 10, 12, 1)),
          end: new Date(Date.UTC(2026, 10, 12, 2)),
          summary: "Focus",
          description: "First 10: open the doc, then read; take notes",
        },
        {
          uid: "bad@247",
          start: new Date(Date.UTC(2026, 10, 12, 3)),
          end: new Date(Date.UTC(2026, 10, 12, 3)),
          summary: "x",
        },
      ],
      { name: "24/7 plan", now },
    );
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    const starts = [...ics.matchAll(/DTSTART:(\S+)/g)].map((m) => m[1]);
    expect(starts).toEqual(["20261112T010000Z", "20261112T020000Z"]);
    expect(ics).toContain("DESCRIPTION:First 10: open the doc\\, then read\\; take notes");
    expect(ics).not.toContain("bad@247");
  });

  it("text escaping and line folding at 75 octets (never inside a Thai character)", () => {
    expect(icsText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
    // A lone CR (or CRLF) is a line break too, never a raw one (G7 R-M12-6).
    expect(icsText("a\rb\r\nc")).toBe("a\\nb\\nc");
    const thai = "SUMMARY:" + "โฟกัส".repeat(20);
    const folded = foldLine(thai);
    for (const part of folded.split("\r\n "))
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.split("\r\n ").join("")).toBe(thai);
  });
});
