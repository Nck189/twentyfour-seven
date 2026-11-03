/**
 * Decor shop basics (SPEC §8.9): coins buy fences, paths, flowers, a pond. Prices are mirrored in
 * SQL (`_decor_price`, M6 migration; a unit test checks they match). Tune with Minnie.
 */
export const DECOR_IDS = ["fence", "path", "flowers", "pond"] as const;
export type DecorId = (typeof DECOR_IDS)[number];

export const DECOR_PRICE: Record<DecorId, number> = {
  fence: 40,
  path: 30,
  flowers: 50,
  pond: 300,
};

export const isDecorId = (v: unknown): v is DecorId =>
  typeof v === "string" && (DECOR_IDS as readonly string[]).includes(v);
