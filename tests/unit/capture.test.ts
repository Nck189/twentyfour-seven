import { describe, expect, it } from "vitest";
import { parseCapture } from "@/lib/backlog/parse";

// 2026-11-03 is a Tuesday.
const TODAY = "2026-11-03";
const p = (text: string) => parseCapture(text, TODAY);

describe("parseCapture: type once, the app fills the fields", () => {
  it("plain text is just a title", () => {
    expect(p("Email advisor")).toEqual({ title: "Email advisor" });
  });

  it("estimate: minutes and hours, English and Thai", () => {
    expect(p("Read 30m").estimate_min).toBe(30);
    expect(p("Read 45min").estimate_min).toBe(45);
    expect(p("Read 1h").estimate_min).toBe(60);
    expect(p("Read 1.5h").estimate_min).toBe(90);
    expect(p("Read 1h30").estimate_min).toBe(90);
    expect(p("อ่าน 20น").estimate_min).toBe(20);
    expect(p("อ่าน 2ชม").estimate_min).toBe(120);
    expect(p("Read 30m").title).toBe("Read");
  });

  it("priority with !", () => {
    expect(p("Pay rent !must").priority).toBe("must");
    expect(p("Pay rent !m").priority).toBe("must");
    expect(p("Pay rent !should").priority).toBe("should");
    expect(p("Pay rent !just").priority).toBe("just_start");
    expect(p("Pay rent !ด่วน").priority).toBe("must");
    expect(p("Pay rent !must").title).toBe("Pay rent");
  });

  it("a day word schedules it (today, tomorrow, weekdays — next occurrence)", () => {
    expect(p("Gym today").scheduled_date).toBe("2026-11-03");
    expect(p("Gym tomorrow").scheduled_date).toBe("2026-11-04");
    expect(p("Gym tmr").scheduled_date).toBe("2026-11-04");
    expect(p("ยิม พรุ่งนี้").scheduled_date).toBe("2026-11-04");
    expect(p("ยิม วันนี้").scheduled_date).toBe("2026-11-03");
    expect(p("Gym fri").scheduled_date).toBe("2026-11-06");
    // Today is Tue: "tue" means today (R-M5-5: next week's Tue fell outside the week strip).
    expect(p("Gym tue").scheduled_date).toBe("2026-11-03");
    expect(p("ยิม ศุกร์").scheduled_date).toBe("2026-11-06");
    expect(p("Gym fri").title).toBe("Gym");
  });

  it("a deadline with 'due' / 'ส่ง' + a day", () => {
    expect(p("Report due fri")).toEqual({ title: "Report", deadline: "2026-11-06" });
    expect(p("รายงาน ส่งศุกร์")).toEqual({ title: "รายงาน", deadline: "2026-11-06" });
    expect(p("รายงาน ส่ง พรุ่งนี้")).toEqual({ title: "รายงาน", deadline: "2026-11-04" });
  });

  it("a project tag with # (key or label prefix, any case)", () => {
    expect(p("Chapter 2 #yop").tag).toBe("yop");
    expect(p("Chapter 2 #Senior").tag).toBe("senior_project");
    expect(p("Lab #class").tag).toBe("class");
    expect(p("Unknown #zzz")).toEqual({ title: "Unknown #zzz" });
  });

  it("everything at once, in any order", () => {
    expect(p("!must ส่งรายงาน 30m พรุ่งนี้ #yop")).toEqual({
      title: "ส่งรายงาน",
      estimate_min: 30,
      priority: "must",
      scheduled_date: "2026-11-04",
      tag: "yop",
    });
  });

  it("never returns an empty title: tokens alone stay as the title", () => {
    expect(p("30m").title).toBe("30m");
    expect(p("  tomorrow ")).toEqual({ title: "tomorrow" });
  });

  it("words that merely contain a token are left alone", () => {
    expect(p("Read 1984 novel")).toEqual({ title: "Read 1984 novel" });
    expect(p("Call mom about friday plans")).toEqual({ title: "Call mom about friday plans" });
  });
});

describe("parseCapture: appointments far ahead (date + time)", () => {
  it("d/m + HH:MM → an appointment that day, 1 h by default", () => {
    expect(p("Dentist 30/11 14:00")).toEqual({
      title: "Dentist",
      appointment: { date: "2026-11-30", start: "14:00", end: "15:00" },
    });
  });
  it("months ahead, Thai and English month names, either order", () => {
    expect(p("หมอฟัน 15 มี.ค. 10:00").appointment).toEqual({
      date: "2027-03-15",
      start: "10:00",
      end: "11:00",
    });
    expect(p("Dentist mar 15 10am").appointment).toEqual({
      date: "2027-03-15",
      start: "10:00",
      end: "11:00",
    });
    expect(p("Dinner 20 december 7pm").appointment).toEqual({
      date: "2026-12-20",
      start: "19:00",
      end: "20:00",
    });
    expect(p("ทานข้าวกับเพื่อน 2 มกราคม 18.30").appointment).toEqual({
      date: "2027-01-02",
      start: "18:30",
      end: "19:30",
    });
  });
  it("a passed date this year means next year; an explicit year (incl. Buddhist era) is kept", () => {
    expect(p("Checkup 1/2 09:00").appointment?.date).toBe("2027-02-01");
    expect(p("Checkup 1/2/2028 09:00").appointment?.date).toBe("2028-02-01");
    expect(p("ตรวจสุขภาพ 1/2/2571 09:00").appointment?.date).toBe("2028-02-01");
  });
  it("a time range sets the end", () => {
    expect(p("Exam 12/12 13:00-16:00").appointment).toEqual({
      date: "2026-12-12",
      start: "13:00",
      end: "16:00",
    });
  });
  it("a date without a time plans a task that day (any distance)", () => {
    expect(p("Pay tax 31/3")).toEqual({ title: "Pay tax", scheduled_date: "2027-03-31" });
    expect(p("Report due 15/12")).toEqual({ title: "Report", deadline: "2026-12-15" });
  });
  it("29/2 after a leap day jumps to the next real 29 Feb, never an invalid date", () => {
    expect(parseCapture("Party 29/2 19:00", "2028-03-01").appointment?.date).toBe("2032-02-29");
    expect(parseCapture("Party 29/2 19:00", "2027-03-01").appointment?.date).toBe("2028-02-29");
  });
  it("a time on its own is left in the title; plain numbers aren't dates", () => {
    expect(p("Call at 14:00")).toEqual({ title: "Call at 14:00" });
    expect(p("Chapter 2 notes")).toEqual({ title: "Chapter 2 notes" });
  });
});
