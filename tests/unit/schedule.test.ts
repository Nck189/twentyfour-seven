import { describe, expect, it } from "vitest";
import { groupWeek, parseIcs } from "@/lib/onboarding/schedule";

const ev = (title: string, start: string, end: string) => ({ title, start, end });

describe("groupWeek: weekdays with the same schedule become one kind of day", () => {
  it("Mon–Fri same class, weekend free → 2 kinds", () => {
    const c = ev("Class", "09:00", "16:00");
    const kinds = groupWeek({ 1: [c], 2: [c], 3: [c], 4: [c], 5: [c] });
    expect(kinds).toEqual([
      { weekdays: [1, 2, 3, 4, 5], events: [c] },
      { weekdays: [6, 7], events: [] },
    ]);
  });
  it("different days stay apart; order of events doesn't matter", () => {
    const a = ev("Math", "09:00", "12:00");
    const b = ev("Lab", "13:00", "16:00");
    const kinds = groupWeek({ 1: [a, b], 3: [b, a], 2: [a] });
    expect(kinds).toEqual([
      { weekdays: [1, 3], events: [a, b] },
      { weekdays: [2], events: [a] },
      { weekdays: [4, 5, 6, 7], events: [] },
    ]);
  });
});

const ICS = [
  "BEGIN:VCALENDAR",
  "BEGIN:VEVENT",
  "SUMMARY:Operations Research",
  "DTSTART;TZID=Asia/Bangkok:20261102T090000",
  "DTEND;TZID=Asia/Bangkok:20261102T120000",
  "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20270301T000000Z",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "SUMMARY:Quality Control",
  // 06:00Z = 13:00 Bangkok, Tuesday
  "DTSTART:20261103T060000Z",
  "DTEND:20261103T090000Z",
  "RRULE:FREQ=WEEKLY",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "SUMMARY:Dentist",
  "DTSTART:20261105T030000Z",
  "DTEND:20261105T040000Z",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "SUMMARY:Holiday",
  "DTSTART;VALUE=DATE:20261106",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "SUMMARY:Very long",
  "  folded title", // RFC 5545 unfolding drops exactly one leading space
  "DTSTART;TZID=Asia/Bangkok:20261106T100000",
  "DTEND;TZID=Asia/Bangkok:20261106T110000",
  "RRULE:FREQ=WEEKLY;BYDAY=FR",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("parseIcs: a class/work timetable exported as .ics", () => {
  it("weekly events land on their weekdays in local time; one-offs and all-day events are ignored", () => {
    expect(parseIcs(ICS, "Asia/Bangkok")).toEqual({
      1: [ev("Operations Research", "09:00", "12:00")],
      2: [ev("Quality Control", "13:00", "16:00")],
      3: [ev("Operations Research", "09:00", "12:00")],
      5: [ev("Very long folded title", "10:00", "11:00")],
    });
  });
  it("an expanded export (the same slot repeated weekly, no RRULE) still counts", () => {
    const expanded = [
      "BEGIN:VCALENDAR",
      ...["20261103", "20261110", "20261117"].flatMap((d) => [
        "BEGIN:VEVENT",
        "SUMMARY:Thesis meeting",
        `DTSTART;TZID=Asia/Bangkok:${d}T140000`,
        `DTEND;TZID=Asia/Bangkok:${d}T150000`,
        "END:VEVENT",
      ]),
      "END:VCALENDAR",
    ].join("\n");
    expect(parseIcs(expanded, "Asia/Bangkok")).toEqual({ 2: [ev("Thesis meeting", "14:00", "15:00")] });
  });
  it("garbage in → empty week", () => {
    expect(parseIcs("hello", "Asia/Bangkok")).toEqual({});
  });
});
