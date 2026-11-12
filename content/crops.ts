/**
 * Crop catalog (SPEC §8.2). Static content: never stored in the DB. Labels come from i18n
 * `crops.<id>`; art lives in `components/art/crops/`.
 */
export const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"] as const;
export type Rarity = (typeof RARITIES)[number];

/** Success-days a crop needs to be ready, by rarity. */
export const GROW_DAYS: Record<Rarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 5,
  legendary: 7,
};

export const CROP_IDS = [
  "radish",
  "turnip",
  "lettuce",
  "carrot",
  "strawberry",
  "blueberry",
  "tomato",
  "corn",
  "pumpkin",
  "melon",
  "sunflower",
  "coffee",
  "dragon_fruit",
  "lavender",
  "grape",
  "cherry_tree",
  "star_fruit",
  "moon_melon",
  "crystal_rose",
  "rainbow_corn",
  // Seasonal crops (content/seasonal.ts): one a month, never from the standard capsule pool.
  "candle_lotus",
  "snow_strawberry",
] as const;
export type CropId = (typeof CROP_IDS)[number];

export type Crop = {
  id: CropId;
  rarity: Rarity;
  growDays: number;
  /** Harvest without replanting (SPEC §8.2: uncommon). */
  regrow: boolean;
  /** Can merge into a giant crop across 3 adjacent block plots (SPEC §8.2 \*). */
  giant: boolean;
  /**
   * A seasonal crop (docs/STORY.md "Seasonal crops"): its month is in content/seasonal.ts. It is
   * never in the capsule pools or the Seed-dex grid; it regrows so one seed lasts its season.
   */
  seasonal: boolean;
};

const crop = (id: CropId, rarity: Rarity, extra: Partial<Crop> = {}): Crop => ({
  id,
  rarity,
  growDays: GROW_DAYS[rarity],
  regrow: rarity === "uncommon",
  giant: false,
  seasonal: false,
  ...extra,
});

export const CROPS: Record<CropId, Crop> = {
  radish: crop("radish", "common"),
  turnip: crop("turnip", "common"),
  lettuce: crop("lettuce", "common"),
  carrot: crop("carrot", "common"),
  strawberry: crop("strawberry", "uncommon"),
  blueberry: crop("blueberry", "uncommon"),
  tomato: crop("tomato", "uncommon"),
  corn: crop("corn", "uncommon"),
  pumpkin: crop("pumpkin", "rare", { giant: true }),
  melon: crop("melon", "rare", { giant: true }),
  sunflower: crop("sunflower", "rare"),
  coffee: crop("coffee", "rare"),
  dragon_fruit: crop("dragon_fruit", "epic"),
  lavender: crop("lavender", "epic"),
  grape: crop("grape", "epic"),
  cherry_tree: crop("cherry_tree", "epic"),
  star_fruit: crop("star_fruit", "legendary"),
  moon_melon: crop("moon_melon", "legendary"),
  crystal_rose: crop("crystal_rose", "legendary"),
  rainbow_corn: crop("rainbow_corn", "legendary"),
  candle_lotus: crop("candle_lotus", "rare", { seasonal: true, regrow: true }),
  snow_strawberry: crop("snow_strawberry", "rare", { seasonal: true, regrow: true }),
};

/** The capsule machine's crops (and the Seed-dex grid): everything but the seasonal crops. */
export const GACHA_CROP_IDS: readonly CropId[] = CROP_IDS.filter((id) => !CROPS[id].seasonal);

/**
 * Seeds anyone can plant before the gacha exists (M7 adds an inventory). Server: plant_seed
 * mirrors this list; a unit test checks they match.
 */
export const STARTER_CROPS: CropId[] = ["radish", "turnip", "lettuce", "carrot"];

export const isCropId = (v: unknown): v is CropId =>
  typeof v === "string" && (CROP_IDS as readonly string[]).includes(v);
