/**
 * Seasonal crops (docs/STORY.md): pure calendar and pricing rules. The server mirrors these in
 * SQL (`_season_*`, 20261113100000_seasonal.sql) and decides every price and offer; the client
 * uses them only to show what the server says and to draw the Seed-dex crop calendar.
 */
import { CROPS, type CropId } from "@/content/crops";
import { ORDER_BONUS, ORDER_VALUE_FACTOR, SELL_BASE } from "@/content/economy";
import {
  PLANTING_DAYS,
  SEASON_SELL_MULT,
  SEASONAL_CALENDAR,
  SEASONAL_ORDER_QTY,
  seasonMonthOf,
} from "@/content/seasonal";

export type SeasonPhase = "planting" | "market";
export type SeasonNow = { month: number; crop: CropId | null; phase: SeasonPhase; day: number };

const parts = (date: string) => ({
  y: Number(date.slice(0, 4)),
  m: Number(date.slice(5, 7)),
  d: Number(date.slice(8, 10)),
});

/** What the calendar says on a local date (YYYY-MM-DD, the user's wake-day). */
export function seasonOn(date: string): SeasonNow {
  const { m, d } = parts(date);
  return {
    month: m,
    crop: SEASONAL_CALENDAR[m] ?? null,
    phase: d <= PLANTING_DAYS ? "planting" : "market",
    day: d,
  };
}

/** The seasonal seed on sale on this date (planting season only), or null. */
export function seasonalSeedOn(date: string): CropId | null {
  const s = seasonOn(date);
  return s.crop && s.phase === "planting" ? s.crop : null;
}

/** The crop whose seasonal market is open on this date, or null. */
export function seasonalMarketOn(date: string): CropId | null {
  const s = seasonOn(date);
  return s.crop && s.phase === "market" ? s.crop : null;
}

/** ×1.5 for a seasonal crop's produce during its market; ×1 for everything else. */
export function seasonPriceMult(itemId: string, date: string): number {
  const [kind, id] = itemId.split(":");
  return kind === "crop" && id !== undefined && id === seasonalMarketOn(date) ? SEASON_SELL_MULT : 1;
}

/**
 * The year of the season a date belongs to for a seasonal crop: its own month and after count
 * for this year, earlier months for last year's season (a November crop sold in January is still
 * last year's). Gifts and "use" beats are once per crop per season-year.
 */
export function seasonYear(crop: CropId, date: string): number {
  const { y, m } = parts(date);
  const month = seasonMonthOf(crop);
  return month !== null && m < month ? y - 1 : y;
}

/** The seasonal special order's coins. */
export function seasonalOrderReward(crop: CropId, qty: number = SEASONAL_ORDER_QTY): number {
  return (
    Math.round(ORDER_VALUE_FACTOR * SEASON_SELL_MULT * SELL_BASE[CROPS[crop].rarity] * qty) + ORDER_BONUS
  );
}

export type CalendarSlot = {
  month: number;
  /** null: no crop for this month yet (a silhouette). */
  crop: CropId | null;
  /** This month is now. */
  current: boolean;
  /** The first day (YYYY-MM-01) the crop is next in season: this month if current, else ahead. */
  returns: string;
};

/** The Seed-dex crop calendar: 12 slots, January first, each saying when it comes (back). */
export function cropCalendar(today: string): CalendarSlot[] {
  const { y, m } = parts(today);
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const year = month >= m ? y : y + 1;
    return {
      month,
      crop: SEASONAL_CALENDAR[month] ?? null,
      current: month === m,
      returns: `${year}-${String(month).padStart(2, "0")}-01`,
    };
  });
}
