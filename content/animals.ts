/**
 * Animals (SPEC §8.6): driven by exercise. Static content; labels come from i18n
 * `animals.<id>` / `produce.<id>`; art lives in `components/art/farm/animals/`.
 * Numbers are mirrored in SQL (M8 migration) and a unit test checks they match.
 */
import type { Rarity } from "./crops";

export const ANIMAL_IDS = [
  "chicken",
  "duck",
  "bunny",
  "cow",
  "sheep",
  "pig",
  "cat",
  "dog",
  "goat",
  "capybara",
  "alpaca",
  "red_panda",
  "golden_goose",
] as const;
export type AnimalId = (typeof ANIMAL_IDS)[number];

export const PRODUCE_IDS = ["egg", "golden_egg", "milk", "wool", "truffle", "gift"] as const;
export type ProduceId = (typeof PRODUCE_IDS)[number];

/** `pitch` = the pet reaction's base note (Hz): small animals call higher. */
export type AnimalDef = { rarity: Rarity; produce: ProduceId; pitch: number };

export const ANIMALS: Record<AnimalId, AnimalDef> = {
  chicken: { rarity: "common", produce: "egg", pitch: 880 },
  duck: { rarity: "common", produce: "egg", pitch: 740 },
  bunny: { rarity: "common", produce: "wool", pitch: 988 },
  cow: { rarity: "uncommon", produce: "milk", pitch: 262 },
  sheep: { rarity: "uncommon", produce: "wool", pitch: 440 },
  pig: { rarity: "uncommon", produce: "truffle", pitch: 330 },
  cat: { rarity: "rare", produce: "gift", pitch: 784 },
  dog: { rarity: "rare", produce: "gift", pitch: 523 },
  goat: { rarity: "rare", produce: "milk", pitch: 494 },
  capybara: { rarity: "epic", produce: "gift", pitch: 294 },
  alpaca: { rarity: "epic", produce: "wool", pitch: 587 },
  red_panda: { rarity: "legendary", produce: "gift", pitch: 659 },
  golden_goose: { rarity: "legendary", produce: "golden_egg", pitch: 698 },
};

/** Hatch rates (an egg is rarer than a capsule: ~1 a week), no pity. Sum = 1. */
export const HATCH_RATES: Record<Rarity, number> = {
  common: 0.5,
  uncommon: 0.3,
  rare: 0.13,
  epic: 0.05,
  legendary: 0.02,
};

export const EXERCISE_TYPES = ["gym", "run", "walk", "other"] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export const EXERCISE_RULES = {
  /** Counted workouts that fill one egg (SPEC: every 3 workouts hatches 1 egg). */
  workoutsPerEgg: 3,
  /** Days of feed per counted workout (SPEC: 1 workout = 2 days). */
  feedDaysPerWorkout: 2,
  /** A workout counts for feed/eggs from this many minutes. */
  minMinutes: 10,
  /** At most this many counted workouts in any rolling 24 h (the rest are still logged). */
  maxCountedPerDay: 2,
  /** Feed can't be banked beyond this many days ahead. */
  maxFeedDays: 14,
  /** A fed animal makes one produce per this many hours. */
  produceEveryHours: 24,
  /** Love: +1 per pet (up to petsPerDay per animal in any rolling 24 h), +1 per collected produce. */
  petsPerDay: 3,
  maxLove: 100,
  /** Love points per heart on the 5-heart meter. */
  loveHeart: 10,
  /** One feed item (setup reward) = this many days. */
  feedItemDays: 1,
} as const;

export const isAnimalId = (v: unknown): v is AnimalId =>
  typeof v === "string" && (ANIMAL_IDS as readonly string[]).includes(v);
export const isExerciseType = (v: unknown): v is ExerciseType =>
  typeof v === "string" && (EXERCISE_TYPES as readonly string[]).includes(v);
