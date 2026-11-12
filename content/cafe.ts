/**
 * Som's café (docs/STORY.md "Som's café", Minnie OK 2026-11-12). Static content, mirrored in SQL
 * (`_cafe_drink_ok`, `_cafe_card_reward`; tests/integration/cafe.test.ts checks parity).
 * Ordering is a game; whether you drank one in real life is a separate, optional answer.
 */
export const DRINKS = [
  "americano",
  "latte",
  "thai_iced_coffee",
  "thai_tea",
  "matcha",
  "cocoa",
  "jasmine_tea",
  "water",
] as const;
export type DrinkId = (typeof DRINKS)[number];

/** Cup art tones per drink (the cup is the same; the drink and its foam differ). */
export const DRINK_COLOR: Record<DrinkId, { drink: string; foam: string | null; iced: boolean }> = {
  americano: { drink: "var(--art-soil-dark)", foam: null, iced: false },
  latte: { drink: "var(--art-wood)", foam: "var(--art-cream)", iced: false },
  thai_iced_coffee: { drink: "var(--art-wood-dark)", foam: "var(--art-cream)", iced: true },
  thai_tea: { drink: "var(--art-orange)", foam: "var(--art-cream)", iced: true },
  matcha: { drink: "var(--art-leaf-2)", foam: "var(--art-leaf-light)", iced: false },
  cocoa: { drink: "var(--art-soil)", foam: "var(--art-pink-light)", iced: false },
  jasmine_tea: { drink: "var(--art-yellow-light)", foam: null, iced: false },
  water: { drink: "var(--art-blue-light)", foam: null, iced: true },
};

/** Stamps never expire and needn't be consecutive. A full card is 10. */
export const CARD_SIZE = 10;

/**
 * A full card's reward: the first one is the café table decor; later ones are a few coins
 * (nothing that makes ordering a daily chore, docs/STORY.md).
 */
export const CARD_REWARD = { first: { decor: "cafe_table" }, later: { coins: 20 } } as const;

/** The café opens with the Farmhouse at level 2 (docs/STORY.md "Story"). */
export const CAFE_HOUSE_LEVEL = 2;

/** The real-life answer right after an order (asked at most once a wake-day). */
export const COFFEE_ANSWERS = ["yes", "later", "play"] as const;
export type CoffeeAnswer = (typeof COFFEE_ANSWERS)[number];
/** The bedtime fallback (only after "later" or no answer that day). */
export const COFFEE_SLOTS = ["none", "morning", "afternoon", "evening"] as const;
export type CoffeeSlot = (typeof COFFEE_SLOTS)[number];

export const isDrinkId = (v: unknown): v is DrinkId =>
  typeof v === "string" && (DRINKS as readonly string[]).includes(v);
