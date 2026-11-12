/**
 * The seasonal crop calendar (docs/STORY.md "Seasonal crops", Minnie OK 2026-11-12). One crop a
 * month; something new every two weeks:
 * - days 1–14 (planting season): the crop's seed is in the seed shop;
 * - day 15 to the month's end (seasonal market): it sells at ×1.5 and has one special order.
 * No FOMO: a missed crop comes back the same month next year. Dates are the user's wake-day
 * (their timezone, default Asia/Bangkok). Static content, never in the DB; the server mirrors it
 * in supabase/migrations/20261113100000_seasonal.sql (tests check they match).
 *
 * Only the next two months have crops so far; the other ten slot in here (with their art, i18n
 * and beats) ahead of their month.
 */
import type { CropId } from "./crops";

/** Month (1 = January) → that month's seasonal crop. Months without one show as silhouettes. */
export const SEASONAL_CALENDAR: Partial<Record<number, CropId>> = {
  11: "candle_lotus",
  12: "snow_strawberry",
};

/** Days 1..PLANTING_DAYS are planting season; the rest of the month is the seasonal market. */
export const PLANTING_DAYS = 14;

/** A seasonal crop sells at this multiple during its market. */
export const SEASON_SELL_MULT = 1.5;

/** The seasonal seed's price in the seed shop (the crop's rarity price, like other seeds). */
export const SEASONAL_SEED_PRICE = 80;

/**
 * The seasonal market's special order: this many of the crop, once per crop per year.
 * Reward = round(ORDER_VALUE_FACTOR × SEASON_SELL_MULT × base × qty) + ORDER_BONUS.
 */
export const SEASONAL_ORDER_QTY = 3;

/** The month of a seasonal crop (null: not seasonal). */
export const seasonMonthOf = (crop: string): number | null => {
  for (const [m, c] of Object.entries(SEASONAL_CALENDAR)) if (c === crop) return Number(m);
  return null;
};
