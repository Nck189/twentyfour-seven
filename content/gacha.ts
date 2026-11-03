/**
 * Seed capsule machine (SPEC §8.5). The server rolls (`pull_gacha`, mirrored in SQL with a parity
 * test); these numbers are the single source both sides read. Tune with Minnie.
 */
import type { Rarity } from "./crops";

/** Base chance per pull. */
export const RATES: Record<Rarity, number> = {
  common: 0.6,
  uncommon: 0.28,
  rare: 0.09,
  epic: 0.025,
  legendary: 0.005,
};

/** Pity (SPEC §8.5): the Nth pull since the last of that tier-or-better is guaranteed. */
export const PITY = {
  /** Rare or better on every 10th pull without one. */
  rare: 10,
  /** Epic or better by the 30th. */
  epic: 30,
  /** Legendary chance rises from the 61st pull since the last one … */
  legendarySoftFrom: 61,
  /** … by this much per pull … */
  legendarySoftStep: 0.06,
  /** … and the 80th is guaranteed. */
  legendary: 80,
} as const;

/** One pull costs one ticket; ×10 costs ten. */
export const PULL_COST = 1;
export const MULTI_PULL = 10;

/** A duplicate seed gives this many shards of that crop (soulstone-style star-up). */
export const DUPE_SHARDS: Record<Rarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 5,
  legendary: 10,
};

/** Shards to go from ★n to ★n+1 (index = current star). ★5 is the top. */
export const STAR_UP_COST: Record<1 | 2 | 3 | 4, number> = { 1: 5, 2: 10, 3: 20, 4: 40 };
