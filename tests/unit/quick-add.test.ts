import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "@/lib/plan/quickAdd";

/**
 * G2 (Minnie OK 2026-11-27): add an appointment the moment it comes up, in plain words, Thai or
 * English. "Today" here is Wed 2 Dec 2026 (Bangkok), 10:00.
 */
const TODAY = "2026-12-02"; // a Wednesday
const p = (text: string) => parseQuickAdd(text, TODAY);

describe("quick add: English", () => {
  it("day words and times", () => {
    expect(p("tomorrow 3pm dentist")).toEqual({
      date: "2026-12-03",
      start: "15:00",
      end: null,
      title: "dentist",
    });
    expect(p("tmr 9am exam")).toEqual({ date: "2026-12-03", start: "09:00", end: null, title: "exam" });
    expect(p("Fri 14:30 meeting with Ploy")).toEqual({
      date: "2026-12-04",
      start: "14:30",
      end: null,
      title: "meeting with Ploy",
    });
    expect(p("today 18.15 gym")).toMatchObject({ date: TODAY, start: "18:15", title: "gym" });
    expect(p("dinner tonight 7pm")).toMatchObject({ date: TODAY, start: "19:00", title: "dinner" });
    expect(p("12am call")).toMatchObject({ start: "00:00" });
    expect(p("12pm lunch")).toMatchObject({ start: "12:00" });
  });
  it("a weekday is the next one; today's own name means today; 'next' skips a week", () => {
    expect(p("wed 9am x")!.date).toBe(TODAY);
    expect(p("mon 9am x")!.date).toBe("2026-12-07");
    expect(p("next wed 9am x")!.date).toBe("2026-12-09");
  });
  it("dates and ranges", () => {
    expect(p("5/12 10:00-11:30 interview")).toEqual({
      date: "2026-12-05",
      start: "10:00",
      end: "11:30",
      title: "interview",
    });
    expect(p("Dec 24 6pm party")).toMatchObject({ date: "2026-12-24", start: "18:00" });
    expect(p("3 Jan 9am class")).toMatchObject({ date: "2027-01-03", start: "09:00" }); // next one
    expect(p("tomorrow 3-4pm tutor")).toMatchObject({ start: "15:00", end: "16:00", title: "tutor" });
  });
  it("no date means today; no time means no appointment", () => {
    expect(p("4pm call mom")).toMatchObject({ date: TODAY, start: "16:00", title: "call mom" });
    expect(p("tomorrow dentist")).toBeNull();
    expect(p("")).toBeNull();
  });
});

describe("quick add: Thai", () => {
  it("day words", () => {
    expect(p("พรุ่งนี้ 15:00 หมอฟัน")).toEqual({
      date: "2026-12-03",
      start: "15:00",
      end: null,
      title: "หมอฟัน",
    });
    expect(p("มะรืนนี้ 9 โมง สอบ")).toMatchObject({ date: "2026-12-04", start: "09:00", title: "สอบ" });
    expect(p("วันศุกร์ บ่าย 2 ประชุม")).toMatchObject({
      date: "2026-12-04",
      start: "14:00",
      title: "ประชุม",
    });
    expect(p("คืนนี้ 2 ทุ่ม กินข้าวกับแม่")).toMatchObject({
      date: TODAY,
      start: "20:00",
      title: "กินข้าวกับแม่",
    });
    expect(p("จันทร์หน้า 10.30 น. ส่งงาน")).toMatchObject({
      date: "2026-12-07",
      start: "10:30",
      title: "ส่งงาน",
    });
  });
  it("Thai ways of saying the time", () => {
    expect(p("บ่ายโมง ติวเลข")).toMatchObject({ start: "13:00", title: "ติวเลข" });
    expect(p("4 โมงเย็น วิ่ง")).toMatchObject({ start: "16:00" });
    expect(p("6 โมงเช้า วิ่ง")).toMatchObject({ start: "06:00" });
    expect(p("3 โมง ประชุม")).toMatchObject({ start: "15:00" }); // colloquial: 3 o'clock = 15:00
    expect(p("10 โมง ประชุม")).toMatchObject({ start: "10:00" });
    expect(p("เที่ยง กินข้าว")).toMatchObject({ start: "12:00" });
    expect(p("ตี 5 ไปสนามบิน")).toMatchObject({ start: "05:00" });
    expect(p("บ่าย 2 ครึ่ง เรียน")).toMatchObject({ start: "14:30" });
    expect(p("พรุ่งนี้ บ่าย 2-4 ติว")).toMatchObject({ start: "14:00", end: "16:00", title: "ติว" });
  });
  it("Thai dates", () => {
    expect(p("24 ธ.ค. 18:00 ปาร์ตี้")).toMatchObject({
      date: "2026-12-24",
      start: "18:00",
      title: "ปาร์ตี้",
    });
    expect(p("5 ม.ค. 9 โมง เปิดเทอม")).toMatchObject({ date: "2027-01-05", start: "09:00" });
  });
});
