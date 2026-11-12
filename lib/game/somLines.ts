/**
 * Som's small reactions (docs/STORY.md "More Som moments"): pure. Kind by design: a hard week gets
 * a gentle line, never a scolding. The words live in i18n (`stats.review.som.<mood>`).
 */
import type { SomPose } from "@/content/story";
import type { WeekSummary } from "@/lib/stats/stats";

export type SomWeek = { mood: "proud" | "good" | "gentle"; pose: SomPose; n: number };

export function somWeek(w: Pick<WeekSummary, "minimumDays" | "perfectDays">): SomWeek {
  const n = w.minimumDays;
  if (n >= 5 || w.perfectDays >= 1) return { mood: "proud", pose: "happy", n };
  if (n >= 1) return { mood: "good", pose: "sit", n };
  return { mood: "gentle", pose: "lookUp", n };
}
