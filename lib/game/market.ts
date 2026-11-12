import { PRODUCE_IDS, type ProduceId } from "@/content/animals";
import { CROPS, isCropId, type CropId } from "@/content/crops";
import {
  ORDER_BONUS,
  ORDER_VALUE_FACTOR,
  PRODUCE_PRICE,
  QUALITY_PRICE,
  SELL_BASE,
  STALL_BONUS,
  UPGRADE_PRICES,
  WEATHER_PRICE_CAP,
  type UpgradeTrack,
} from "@/content/economy";
import { QUALITIES, type Quality } from "@/content/game";

/** What's on the market shelf (docs/ECONOMY.md). The server sets every price; this mirrors it. */
export type MarketItem =
  { kind: "crop"; cropId: CropId; quality: Quality; mult: number } | { kind: "produce"; id: ProduceId };

/** `crop:<id>:<quality>:<weather×100>` (v2), `crop:<id>` (older stock), `produce:<id>`. */
export function parseItem(itemId: string): MarketItem | null {
  const [kind, id, q, m] = itemId.split(":");
  if (kind === "produce")
    return (PRODUCE_IDS as readonly string[]).includes(id ?? "") ? { kind, id: id as ProduceId } : null;
  if (kind !== "crop" || !isCropId(id)) return null;
  if (q === undefined) return { kind, cropId: id, quality: "normal", mult: 1 };
  if (!(QUALITIES as readonly string[]).includes(q) || !m || !/^\d+$/.test(m)) return null;
  return { kind, cropId: id, quality: q as Quality, mult: Number(m) / 100 };
}

/** Coins for one unit at a stall of this level (null: not sellable). */
export function sellPrice(itemId: string, stallLevel: number): number | null {
  const it = parseItem(itemId);
  if (!it) return null;
  const stall = 1 + STALL_BONUS * stallLevel;
  if (it.kind === "produce") return Math.round(PRODUCE_PRICE[it.id] * stall);
  const base = SELL_BASE[CROPS[it.cropId].rarity];
  return Math.round(base * QUALITY_PRICE[it.quality] * Math.min(it.mult, WEATHER_PRICE_CAP) * stall);
}

/** A daily order's coins for `qty` of a crop. */
export function orderReward(cropId: CropId, qty: number): number {
  return Math.round(ORDER_VALUE_FACTOR * SELL_BASE[CROPS[cropId].rarity] * qty) + ORDER_BONUS;
}

/** The next level's price, or null at the top. */
export function nextUpgradePrice(track: UpgradeTrack, level: number): number | null {
  return (UPGRADE_PRICES[track] as readonly number[])[level] ?? null;
}
