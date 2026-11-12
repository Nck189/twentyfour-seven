/**
 * Exam week with Som (docs/STORY.md "More Som moments"): pure. An appointment counts as an exam
 * when its title says so. Careful with everyday words (G7 STORY-R2):
 * - Thai: สอบ is an exam, but not inside ตรวจสอบ (check), ทดสอบ (test a thing), สอบถาม (ask) or
 *   สอบสวน (investigate), สอบเทียบ (calibrate) or ผู้สอบบัญชี (auditor) (G7 STORY-R24).
 * - English: exam / midterm / finals; "final" only with exam/test/week; "quiz" only with a number
 *   ("Quiz 3"), so "Quiz night" and "Final Fantasy" aren't exams.
 */
const EN =
  /\b(exams?|midterms?)\b|(?<!\bnba\s)\bfinals\b|\bfinal\s+(exams?|tests?|week)\b|\bquiz(zes)?\s*#?\d/i;
const TH = /(?<!ตรวจ|ทด|ผู้)สอบ(?!ถาม|สวน|เทียบ|บัญชี)|ควิซ/;

export function isExam(title: string | null | undefined): boolean {
  return Boolean(title) && (EN.test(title!) || TH.test(title!));
}

/** Only one-off appointments count, not a fixed class or work event (G7 STORY-R16). */
export function hasExam(events: readonly { key: string; title: string | null }[]): boolean {
  return events.some((e) => e.key === "appointment" && isExam(e.title));
}
