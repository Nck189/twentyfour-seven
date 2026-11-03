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

export type AnimalDef = { rarity: Rarity; produce: ProduceId };

export const ANIMALS: Record<AnimalId, AnimalDef> = {
  chicken: { rarity: "common", produce: "egg" },
  duck: { rarity: "common", produce: "egg" },
  bunny: { rarity: "common", produce: "wool" },
  cow: { rarity: "uncommon", produce: "milk" },
  sheep: { rarity: "uncommon", produce: "wool" },
  pig: { rarity: "uncommon", produce: "truffle" },
  cat: { rarity: "rare", produce: "gift" },
  dog: { rarity: "rare", produce: "gift" },
  goat: { rarity: "rare", produce: "milk" },
  capybara: { rarity: "epic", produce: "gift" },
  alpaca: { rarity: "epic", produce: "wool" },
  red_panda: { rarity: "legendary", produce: "gift" },
  golden_goose: { rarity: "legendary", produce: "golden_egg" },
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
  /** At most this many counted workouts per local day (the rest are still logged). */
  maxCountedPerDay: 2,
  /** Feed can't be banked beyond this many days ahead. */
  maxFeedDays: 14,
  /** A fed animal makes one produce per this many hours. */
  produceEveryHours: 24,
  /** Love: +1 per pet (up to petsPerDay per animal per local day), +1 per collected produce. */
  petsPerDay: 3,
  maxLove: 100,
  /** One feed item (setup reward) = this many days. */
  feedItemDays: 1,
} as const;

export const isAnimalId = (v: unknown): v is AnimalId =>
  typeof v === "string" && (ANIMAL_IDS as readonly string[]).includes(v);
export const isExerciseType = (v: unknown): v is ExerciseType =>
  typeof v === "string" && (EXERCISE_TYPES as readonly string[]).includes(v);
