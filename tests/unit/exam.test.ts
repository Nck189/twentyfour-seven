import { describe, expect, it } from "vitest";
import { hasExam, isExam } from "@/lib/game/exam";

describe("exam week (docs/STORY.md): an appointment tagged exam/สอบ", () => {
  it("recognises exams in English and Thai", () => {
    for (const t of [
      "Exam Calc 1",
      "Midterm IE",
      "final exam",
      "Quiz 3",
      "สอบกลางภาค",
      "สอบ OR",
      "ควิซ สถิติ",
    ])
      expect(isExam(t)).toBe(true);
  });
  it("ignores ordinary appointments and empty titles", () => {
    for (const t of ["Dentist 14:00", "Gym", "Testing lab report", "examine the plan?"])
      expect(isExam(t)).toBe(false);
    expect(isExam(null)).toBe(false);
    expect(isExam("")).toBe(false);
  });
  it("G7 STORY-R2: everyday Thai/English words that contain สอบ/quiz/final aren't exams", () => {
    for (const t of [
      "ตรวจสอบรถ",
      "สอบถามข้อมูลธนาคาร",
      "ทดสอบระบบ",
      "สอบสวน",
      "Quiz night at bar",
      "Final Fantasy night",
      "Final project studio",
      "สอบเทียบเครื่องมือ",
      "นัดผู้สอบบัญชี",
      "NBA Finals",
    ])
      expect(isExam(t)).toBe(false);
    for (const t of ["Finals week", "Final exam Stat", "สอบปลายภาค", "สอบย่อย", "Quiz 2 OR"])
      expect(isExam(t)).toBe(true);
  });
  it("G7 STORY-R16: only appointments count, not fixed class/work events", () => {
    expect(hasExam([{ key: "class", title: "Midterm review class" }])).toBe(false);
    expect(hasExam([{ key: "appointment", title: "Midterm" }])).toBe(true);
  });
  it("hasExam looks at any event's title", () => {
    expect(
      hasExam([
        { key: "appointment", title: "Dentist" },
        { key: "appointment", title: "Midterm" },
      ]),
    ).toBe(true);
    expect(hasExam([{ key: "appointment", title: null }])).toBe(false);
    expect(hasExam([])).toBe(false);
  });
});
