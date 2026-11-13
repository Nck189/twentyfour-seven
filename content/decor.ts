/**
 * Decor shop basics (SPEC §8.9): coins buy fences, paths, flowers, a pond. Prices are mirrored in
 * SQL (`_decor_price`, M6 migration; a unit test checks they match). Tune with Minnie.
 */
/** Always in the shop. */
export const BASIC_DECOR = ["fence", "path", "flowers", "pond"] as const;
/** Festival decor (SPEC §8.8): in the shop only during its month (content/seasons.ts). */
export const FESTIVAL_DECOR = [
  "fireworks",
  "red_lantern",
  "water_bowl",
  "jasmine",
  "krathong",
  "star_tree",
] as const;
/** Earned only (unlock ladder, SPEC §8.8b): never in the shop. */
export const REWARD_DECOR = ["garden_lantern", "mailbox", "cafe_table", "farm_sign", "wind_chime"] as const;
export const SHOP_DECOR = [...BASIC_DECOR, ...FESTIVAL_DECOR] as const;
export const DECOR_IDS = [...SHOP_DECOR, ...REWARD_DECOR] as const;
export type DecorId = (typeof DECOR_IDS)[number];
export type ShopDecorId = (typeof SHOP_DECOR)[number];
export type FestivalDecorId = (typeof FESTIVAL_DECOR)[number];

export const DECOR_PRICE: Record<ShopDecorId, number> = {
  fence: 40,
  path: 30,
  flowers: 50,
  pond: 300,
  fireworks: 60,
  red_lantern: 80,
  water_bowl: 70,
  jasmine: 60,
  krathong: 90,
  star_tree: 120,
};

export const isDecorId = (v: unknown): v is DecorId =>
  typeof v === "string" && (DECOR_IDS as readonly string[]).includes(v);
