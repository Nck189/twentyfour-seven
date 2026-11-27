import { describe, expect, it } from "vitest";
import { endAfter, parseQuickAdd } from "@/lib/plan/quickAdd";

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

describe("quick add: G7 G fixes", () => {
  it("S2-1/2: am/pm with minutes, and am/pm on both ends of a range", () => {
    expect(p("8:00pm call")).toMatchObject({ start: "20:00", title: "call" });
    expect(p("7.30 pm dinner")).toMatchObject({ start: "19:30", title: "dinner" });
    expect(p("3pm-5pm tutor")).toMatchObject({ start: "15:00", end: "17:00", title: "tutor" });
    expect(p("11am-1pm lunch")).toMatchObject({ start: "11:00", end: "13:00", title: "lunch" });
    expect(p("11-1pm lunch")).toMatchObject({ start: "11:00", end: "13:00" });
  });
  it("S2-3: an end an hour after the start, past midnight if need be (never the start itself)", () => {
    expect(endAfter("14:00")).toBe("15:00");
    expect(endAfter("23:30")).toBe("00:30");
    expect(endAfter("23:59")).toBe("00:59");
  });
  it("S2-5: 'X หน้า' and 'next X' mean X of next week; 'X นี้' this week's", () => {
    const mon = "2026-11-30"; // Monday
    expect(parseQuickAdd("ศุกร์หน้า บ่าย 2 ประชุม", mon)).toMatchObject({
      date: "2026-12-11",
      title: "ประชุม",
    });
    expect(parseQuickAdd("next fri 2pm x", mon)!.date).toBe("2026-12-11");
    expect(parseQuickAdd("ศุกร์นี้ 4 โมงเย็น ประชุม", mon)).toMatchObject({
      date: "2026-12-04",
      title: "ประชุม",
    });
    expect(parseQuickAdd("fri 2pm x", mon)!.date).toBe("2026-12-04");
  });
  it("S2-6: full Thai month names, no-dot abbreviations, and 'วันที่ N'", () => {
    expect(p("สอบ 8 ธันวาคม บ่าย 1")).toMatchObject({ date: "2026-12-08", start: "13:00", title: "สอบ" });
    expect(p("8 ธค 9 โมง สอบ")).toMatchObject({ date: "2026-12-08", start: "09:00" });
    expect(p("วันที่ 8 บ่าย 2 ส่งงาน")).toMatchObject({
      date: "2026-12-08",
      start: "14:00",
      title: "ส่งงาน",
    });
    expect(p("ที่ 1 10 โมง x")!.date).toBe("2027-01-01"); // the 1st already passed this month
  });
  it("S3: Thai weekday names inside other words aren't days; ตี 12 is midnight", () => {
    expect(p("ดูพระจันทร์ 2 ทุ่ม")).toMatchObject({ date: TODAY, start: "20:00", title: "ดูพระจันทร์" });
    expect(p("พระอาทิตย์ตก 6 โมงเย็น")).toMatchObject({ date: TODAY, title: "พระอาทิตย์ตก" });
    expect(p("พรุ่งนี้วันจันทร์ 9 โมง x")!.date).toBe("2026-12-03"); // "พรุ่งนี้" wins; วันจันทร์ is consumed
    expect(p("ตี 12 ดูบอล")).toMatchObject({ start: "00:00" });
    expect(p("Mon. 9am x")).toMatchObject({ title: "x" });
  });
});

describe("quick add: G7 G re-review", () => {
  const tmr = "2026-12-03";
  const r = (text: string) => parseQuickAdd(text, TODAY, tmr);
  it("S2: 'ที่ N' after a word is an ordinal, not a date", () => {
    expect(r("อ่านบทที่ 5 บ่าย 2")).toMatchObject({ date: tmr, start: "14:00", title: "อ่านบทที่ 5" });
    expect(r("ทำแบบฝึกหัดข้อที่ 4 บ่าย 3")).toMatchObject({ date: tmr, start: "15:00" });
    expect(r("ครั้งที่ 2 บ่าย 2 ประชุม")).toMatchObject({ date: tmr, start: "14:00" });
    expect(r("ไปที่ 10 โมง ร้าน")).toMatchObject({ date: tmr, start: "10:00" });
    expect(r("วันที่ 8 บ่าย 2 x")!.date).toBe("2026-12-08");
  });
  it("S2: a weekday glued to the word before it is still a day (only พระ… is excluded)", () => {
    expect(r("ประชุมศุกร์ บ่าย 2")).toMatchObject({ date: "2026-12-04", title: "ประชุม" });
    expect(r("ส่งงานศุกร์หน้า 10 โมง")!.date).toBe("2026-12-11");
    expect(r("ดูพระจันทร์ 2 ทุ่ม")!.date).toBe(tmr);
  });
  it("S3: month abbreviations inside words aren't months; day 31 rolls to a month that has one; weekday + date prefers the date", () => {
    expect(r("แก้ 3 สคริปต์ บ่าย 2")).toMatchObject({ date: tmr, title: "แก้ 3 สคริปต์" });
    expect(r("นัด 2 พยาบาล 10 โมง")!.date).toBe(tmr);
    expect(parseQuickAdd("วันที่ 31 9 โมง x", "2026-11-05")!.date).toBe("2026-12-31");
    expect(r("วันจันทร์ที่ 8 บ่าย 2 x")).toMatchObject({ date: "2026-12-08", title: "x" });
  });
});
