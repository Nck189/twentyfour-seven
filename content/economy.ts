/** Static economy numbers (SPEC §8.1). Server RPCs mirror these; tests check they match. */
import type { Priority } from "@/lib/backlog";
import type { ProduceId } from "./animals";
import type { Rarity } from "./crops";
import type { Quality } from "./game";

/** Coins for finishing a backlog item: Must > Should > Just start. */
export const COINS_BY_PRIORITY: Record<Priority, number> = {
  must: 30,
  should: 20,
  just_start: 10,
};

/**
 * Anti-farming (SPEC §0.6, G7 R-M5-1): a task finished within this many minutes of being added,
 * or of its priority being raised, pays only QUICK_FINISH_COINS. Server: complete_backlog_item.
 */
export const QUICK_FINISH_MIN = 10;
export const QUICK_FINISH_COINS = COINS_BY_PRIORITY.just_start;
/** At most this many backlog coins in any rolling 24 h (no local midnight to game, R-M8-R1). */
export const BACKLOG_DAILY_COIN_CAP = 150;

// ---------- Economy v2 (docs/ECONOMY.md, Minnie OK 2026-11-11) ----------
// Server mirrors: supabase/migrations/20261112010000_market.sql (tests/integration/market.test.ts
// checks the prices match).

/** Market base price per unit of a crop, by rarity. */
export const SELL_BASE: Record<Rarity, number> = {
  common: 6,
  uncommon: 10,
  rare: 16,
  epic: 30,
  legendary: 60,
};
/** Animal produce has no quality or weather: its base price is the price. */
export const PRODUCE_PRICE: Record<ProduceId, number> = {
  egg: 4,
  golden_egg: 20,
  milk: 6,
  wool: 6,
  truffle: 12,
  gift: 15,
};
export const QUALITY_PRICE: Record<Quality, number> = { normal: 1, silver: 1.25, gold: 1.5, prismatic: 2 };
/** Weather (mutation) multipliers count up to this much at the market. */
export const WEATHER_PRICE_CAP = 4;
/** Market stall upgrade: +10% sell price per level. */
export const STALL_BONUS = 0.1;

/** Seed shop: 2 uncommon + 1 rare offer a day (commons are free starters; epic+ are capsule-only). */
export const SEED_SHOP_PRICE: Partial<Record<Rarity, number>> = { uncommon: 30, rare: 80 };
export const SEED_SHOP_OFFERS: Partial<Record<Rarity, number>> = { uncommon: 2, rare: 1 };

/** Coins → tickets. */
export const TICKET_EXCHANGE = { coins: 150, perWeek: 2 } as const;

/** Tiered upgrades: the price of each next level. */
export const UPGRADE_PRICES = { stall: [200, 500], barn: [300, 800], house: [400, 1000, 2000] } as const;
export type UpgradeTrack = keyof typeof UPGRADE_PRICES;
export const UPGRADE_TRACKS = Object.keys(UPGRADE_PRICES) as UpgradeTrack[];

/** Daily orders: 1 + barn level a day; reward = round(1.5 × normal value) + 10. */
export const ORDER_VALUE_FACTOR = 1.5;
export const ORDER_BONUS = 10;

/** Reward jar ("My rewards"): limits, and the one quiet hint the first time coins reach this. */
export const REWARD_COST = { min: 10, max: 10_000 } as const;
export const REWARD_TITLE_MAX = 60;
export const REWARD_HINT_COINS = 300;
