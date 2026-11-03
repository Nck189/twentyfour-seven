import { QUALITIES, QUALITY_THRESHOLDS, STAR_QUALITY_BONUS, type Quality } from "@/content/game";

/** What a crop "remembers" from the days it grew (SPEC §8.2 quality inputs). */
export type GrowthRecord = {
  /** Success days the crop grew on. */
  days: number;
  /** Of those, days with the block's first-10 done (the fertilizer). */
  first10Days: number;
  /** Checklist rates (0..1) of the growing days that had a checklist. */
  checklistRates: number[];
};

/**
 * Quality score 0..1: the first-10 rate, averaged with the checklist rate when the block had a
 * checklist; each star above ★1 adds a little.
 */
export function qualityScore(rec: GrowthRecord, star = 1): number {
  if (rec.days === 0) return 0;
  const first10 = rec.first10Days / rec.days;
  const base =
    rec.checklistRates.length > 0
      ? (first10 + rec.checklistRates.reduce((a, b) => a + b, 0) / rec.checklistRates.length) / 2
      : first10;
  return Math.min(1, base + Math.max(0, star - 1) * STAR_QUALITY_BONUS);
}

/** Quality from the score, then one step down per wilt (never below Normal). */
export function qualityOf(rec: GrowthRecord, star = 1, wiltLevel = 0): Quality {
  const s = qualityScore(rec, star);
  let i = 0;
  if (s >= QUALITY_THRESHOLDS.silver) i = 1;
  if (s >= QUALITY_THRESHOLDS.gold) i = 2;
  if (s >= QUALITY_THRESHOLDS.prismatic) i = 3;
  return QUALITIES[Math.max(0, i - wiltLevel)]!;
}
