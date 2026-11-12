/**
 * Exam week with Som (docs/STORY.md "More Som moments"): pure. An appointment counts as an exam
 * when its title says so in English or Thai. Whole words only in English ("examine" isn't one).
 */
const EXAM = /\b(exams?|midterms?|finals?|quiz(zes)?)\b|สอบ|ควิซ/i;

export function isExam(title: string | null | undefined): boolean {
  return Boolean(title) && EXAM.test(title!);
}

export function hasExam(events: readonly { title: string | null }[]): boolean {
  return events.some((e) => isExam(e.title));
}
