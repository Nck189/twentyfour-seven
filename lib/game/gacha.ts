import { CROPS, GACHA_CROP_IDS, RARITIES, type CropId, type Rarity } from "@/content/crops";
import { PITY, RATES } from "@/content/gacha";

/** Pulls since the last result of that tier or better (what `game_state.pity` stores). */
export type Pity = { since_rare: number; since_epic: number; since_legendary: number };

export const NO_PITY: Pity = { since_rare: 0, since_epic: 0, since_legendary: 0 };

const RANK: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };

/** Legendary chance for this pull: base, rising from the soft-pity pull, certain at the hard one. */
export function legendaryChance(p: Pity): number {
  const n = p.since_legendary + 1; // this pull's number since the last legendary
  if (n >= PITY.legendary) return 1;
  if (n < PITY.legendarySoftFrom) return RATES.legendary;
  return Math.min(1, RATES.legendary + PITY.legendarySoftStep * (n - PITY.legendarySoftFrom + 1));
}

/**
 * One pull, deterministic given two uniform numbers in [0, 1) (the server draws them with
 * `random()`; tests pass their own). `r` picks the rarity, `c` the crop within it.
 * SQL mirror: `_gacha_roll` (supabase/migrations/…_m7_gacha.sql), parity-tested.
 */
export function roll(p: Pity, r: number, c: number): { rarity: Rarity; cropId: CropId; pity: Pity } {
  const leg = legendaryChance(p);
  let rarity: Rarity;
  if (r < leg) rarity = "legendary";
  else if (r < leg + RATES.epic) rarity = "epic";
  else if (r < leg + RATES.epic + RATES.rare) rarity = "rare";
  else if (r < leg + RATES.epic + RATES.rare + RATES.uncommon) rarity = "uncommon";
  else rarity = "common";
  // Guarantees (the Nth pull without one).
  if (RANK[rarity] < RANK.epic && p.since_epic + 1 >= PITY.epic) rarity = "epic";
  if (RANK[rarity] < RANK.rare && p.since_rare + 1 >= PITY.rare) rarity = "rare";
  const pool = GACHA_CROP_IDS.filter((id) => CROPS[id].rarity === rarity);
  const cropId = pool[Math.min(pool.length - 1, Math.floor(c * pool.length))]!;
  const k = RANK[rarity];
  return {
    rarity,
    cropId,
    pity: {
      since_rare: k >= RANK.rare ? 0 : p.since_rare + 1,
      since_epic: k >= RANK.epic ? 0 : p.since_epic + 1,
      since_legendary: k >= RANK.legendary ? 0 : p.since_legendary + 1,
    },
  };
}

/** Many pulls from a random source (simulation and tests). */
export function simulate(n: number, rand: () => number, start: Pity = NO_PITY) {
  let p = start;
  const counts = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>;
  let longestWithoutRare = 0;
  let longestWithoutEpic = 0;
  let longestWithoutLegendary = 0;
  for (let i = 0; i < n; i++) {
    const out = roll(p, rand(), rand());
    counts[out.rarity]++;
    p = out.pity;
    longestWithoutRare = Math.max(longestWithoutRare, p.since_rare);
    longestWithoutEpic = Math.max(longestWithoutEpic, p.since_epic);
    longestWithoutLegendary = Math.max(longestWithoutLegendary, p.since_legendary);
  }
  return { counts, longestWithoutRare, longestWithoutEpic, longestWithoutLegendary, pity: p };
}
