/**
 * The factory (M13, SPEC §9 "Factory (IE flavor)"): machines turn crops and animal goods into
 * products that sell for more than their inputs. Static content; the server mirrors every number
 * (supabase/migrations/20261114000000_factory.sql, `factory_catalog()`), and
 * tests/integration/factory.test.ts checks the two copies match.
 */
import type { ProduceId } from "./animals";
import type { CropId } from "./crops";

export const MACHINE_IDS = ["jam_jar", "cheese_press", "loom", "bakery"] as const;
export type MachineId = (typeof MACHINE_IDS)[number];

export const PRODUCT_IDS = [
  "pickles",
  "strawberry_jam",
  "tomato_sauce",
  "butter",
  "cheese",
  "yarn",
  "sweater",
  "lavender_sachet",
  "carrot_cake",
  "cornbread",
  "pumpkin_pie",
] as const;
export type ProductId = (typeof PRODUCT_IDS)[number];

/** A recipe input: any quality of a crop (lowest used first) or an animal good. */
export type RecipeInput = { crop: CropId; qty: number } | { produce: ProduceId; qty: number };

export type Recipe = {
  id: ProductId;
  machine: MachineId;
  inputs: RecipeInput[];
  /** Minutes on the machine at speed level 0. */
  minutes: number;
  /** Market price per unit (before the stall bonus). */
  price: number;
};

export type MachineDef = {
  /** Coins to build it. */
  price: number;
  /** Speed upgrades: the price of each next level. */
  speedPrices: readonly number[];
  /** Queue capacity upgrades: the price of each next level. */
  capacityPrices: readonly number[];
};

export const MACHINES: Record<MachineId, MachineDef> = {
  jam_jar: { price: 150, speedPrices: [200, 500], capacityPrices: [150, 400] },
  cheese_press: { price: 250, speedPrices: [250, 600], capacityPrices: [200, 450] },
  loom: { price: 300, speedPrices: [250, 600], capacityPrices: [200, 450] },
  bakery: { price: 400, speedPrices: [300, 700], capacityPrices: [250, 500] },
};

/** Process time × this at speed level 0, 1, 2. */
export const SPEED_FACTOR = [1, 0.8, 0.65] as const;
/** Jobs a machine holds (running + waiting + ready to collect) at capacity level 0, 1, 2. */
export const QUEUE_CAPACITY = [2, 3, 4] as const;

/**
 * Prices are about 1.4× the inputs' normal market value (docs/ECONOMY.md), so processing pays,
 * but a quality crop can still be worth more sold as it is: a real make-or-sell choice.
 */
export const RECIPES: Record<ProductId, Recipe> = {
  pickles: {
    id: "pickles",
    machine: "jam_jar",
    inputs: [
      { crop: "radish", qty: 2 },
      { crop: "turnip", qty: 2 },
    ],
    minutes: 20,
    price: 34,
  },
  strawberry_jam: {
    id: "strawberry_jam",
    machine: "jam_jar",
    inputs: [{ crop: "strawberry", qty: 3 }],
    minutes: 30,
    price: 42,
  },
  tomato_sauce: {
    id: "tomato_sauce",
    machine: "jam_jar",
    inputs: [{ crop: "tomato", qty: 3 }],
    minutes: 40,
    price: 44,
  },
  butter: {
    id: "butter",
    machine: "cheese_press",
    inputs: [{ produce: "milk", qty: 2 }],
    minutes: 30,
    price: 18,
  },
  cheese: {
    id: "cheese",
    machine: "cheese_press",
    inputs: [{ produce: "milk", qty: 3 }],
    minutes: 60,
    price: 28,
  },
  yarn: { id: "yarn", machine: "loom", inputs: [{ produce: "wool", qty: 2 }], minutes: 30, price: 18 },
  sweater: { id: "sweater", machine: "loom", inputs: [{ produce: "wool", qty: 4 }], minutes: 120, price: 40 },
  lavender_sachet: {
    id: "lavender_sachet",
    machine: "loom",
    inputs: [
      { crop: "lavender", qty: 1 },
      { produce: "wool", qty: 1 },
    ],
    minutes: 60,
    price: 52,
  },
  carrot_cake: {
    id: "carrot_cake",
    machine: "bakery",
    inputs: [
      { crop: "carrot", qty: 2 },
      { produce: "egg", qty: 2 },
    ],
    minutes: 45,
    price: 30,
  },
  cornbread: {
    id: "cornbread",
    machine: "bakery",
    inputs: [
      { crop: "corn", qty: 3 },
      { produce: "egg", qty: 1 },
    ],
    minutes: 60,
    price: 48,
  },
  pumpkin_pie: {
    id: "pumpkin_pie",
    machine: "bakery",
    inputs: [
      { crop: "pumpkin", qty: 1 },
      { produce: "egg", qty: 2 },
      { produce: "milk", qty: 1 },
    ],
    minutes: 90,
    price: 46,
  },
};

export const isMachineId = (v: unknown): v is MachineId => (MACHINE_IDS as readonly unknown[]).includes(v);
export const isProductId = (v: unknown): v is ProductId => (PRODUCT_IDS as readonly unknown[]).includes(v);
export const recipesFor = (m: MachineId): Recipe[] =>
  PRODUCT_IDS.map((p) => RECIPES[p]).filter((r) => r.machine === m);

/** The KPI panel looks back this far (days). */
export const KPI_WINDOW_DAYS = 7;
