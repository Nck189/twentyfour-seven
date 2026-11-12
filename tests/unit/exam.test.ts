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
  it("hasExam looks at any event's title", () => {
    expect(hasExam([{ title: "Dentist" }, { title: "Midterm" }])).toBe(true);
    expect(hasExam([{ title: null }])).toBe(false);
    expect(hasExam([])).toBe(false);
  });
});
