/**
 * Farm rule numbers (SPEC §8.1–8.4, §8.7). Tunable with Minnie; `lib/game` reads them, and any
 * server RPC that needs one mirrors it (with a test that checks they match).
 */

/** A block succeeds with an on-time start (±10 min, SPEC §4.3) OR this share of its checklist. */
export const SUCCESS_CHECKLIST_RATE = 0.7;
/** On-time start tolerance in minutes (same as Today, SPEC §4.3). */
export const ON_TIME_MIN = 10;

/** Penalties (SPEC §8.4): consecutive misses of one block. */
export const WILT_AT_MISSES = 3;
export const DEAD_AT_MISSES = 5;

/** Perfect day (SPEC §8.7): minimum day + Day OEE at least this. */
export const PERFECT_DAY_OEE = 0.8;

/**
 * Streak (SPEC §8.7, §8.5 ticket income). A scarecrow (freeze) is earned every `freezeEvery`
 * days of streak, held up to `maxFreezes`, and used up by itself on a missed day. Mirrored in
 * `settle_days` (M9 migration) with a test.
 */
export const STREAK_RULES = {
  freezeEvery: 7,
  maxFreezes: 2,
  perfectDayTickets: 1,
  /**
   * Streak length → tickets, paid the first time the best streak reaches it (once per account,
   * so restarting never pays them again; G7 R-M9-6).
   */
  milestones: { 7: 5, 14: 5, 30: 5 } as Record<number, number>,
  /** After 30: every `everyDays` days of a running streak (60, 90, …) pays `everyTickets`. */
  everyDays: 30,
  everyTickets: 5,
} as const;

/** Mutations (SPEC §8.3): weather from yesterday's behavior; they stack multiplicatively. */
export const MUTATION_IDS = ["sunrise_glow", "dew", "moonlit", "breeze", "spark", "rainbow"] as const;
export type MutationId = (typeof MUTATION_IDS)[number];
export const MUTATION_MULTIPLIER: Record<MutationId, number> = {
  sunrise_glow: 2,
  dew: 1.5,
  moonlit: 2,
  breeze: 1.5,
  spark: 2,
  rainbow: 5,
};

/** Quality (SPEC §8.2) from the first-10 rate + checklist % over a crop's growing days. */
export const QUALITIES = ["normal", "silver", "gold", "prismatic"] as const;
export type Quality = (typeof QUALITIES)[number];
/** Minimum score for each quality (score 0..1; the highest threshold met wins). */
export const QUALITY_THRESHOLDS: Record<Exclude<Quality, "normal">, number> = {
  silver: 0.4,
  gold: 0.7,
  prismatic: 0.9,
};
/** Each star above ★1 adds this to the quality score (SPEC §8.5: stars raise quality). */
export const STAR_QUALITY_BONUS = 0.05;

/** Giant crop (SPEC §8.2): chance per day that 3 ready, adjacent, all-successful plots merge. */
export const GIANT_MERGE_CHANCE = 1 / 3;
