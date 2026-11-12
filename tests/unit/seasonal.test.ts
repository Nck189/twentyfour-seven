import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CROP_IDS, CROPS, GACHA_CROP_IDS } from "@/content/crops";
import {
  PLANTING_DAYS,
  SEASON_SELL_MULT,
  SEASONAL_CALENDAR,
  SEASONAL_ORDER_QTY,
  SEASONAL_SEED_PRICE,
  seasonMonthOf,
} from "@/content/seasonal";
import { SEED_SHOP_PRICE } from "@/content/economy";
import { roll, NO_PITY } from "@/lib/game/gacha";
import { sellPrice } from "@/lib/game/market";
import {
  cropCalendar,
  seasonOn,
  seasonPriceMult,
  seasonYear,
  seasonalMarketOn,
  seasonalOrderReward,
  seasonalSeedOn,
} from "@/lib/game/seasonal";

/** Seasonal crops (docs/STORY.md "Seasonal crops"): the pure calendar and pricing rules. */
describe("seasonal calendar", () => {
  it("November is the Candle Lotus, December the Snow Strawberry; every seasonal crop has one month", () => {
    expect(SEASONAL_CALENDAR[11]).toBe("candle_lotus");
    expect(SEASONAL_CALENDAR[12]).toBe("snow_strawberry");
    const seasonal = CROP_IDS.filter((id) => CROPS[id].seasonal);
    expect(seasonal.sort()).toEqual(Object.values(SEASONAL_CALENDAR).sort());
    for (const c of seasonal) expect(seasonMonthOf(c)).not.toBeNull();
    expect(seasonMonthOf("radish")).toBeNull();
  });

  it("days 1–14 are planting season (the seed is on sale), day 15 to the end the market", () => {
    expect(PLANTING_DAYS).toBe(14);
    expect(seasonOn("2026-11-01")).toEqual({ month: 11, crop: "candle_lotus", phase: "planting", day: 1 });
    expect(seasonalSeedOn("2026-11-14")).toBe("candle_lotus");
    expect(seasonalMarketOn("2026-11-14")).toBeNull();
    expect(seasonalSeedOn("2026-11-15")).toBeNull();
    expect(seasonalMarketOn("2026-11-15")).toBe("candle_lotus");
    expect(seasonalMarketOn("2026-11-30")).toBe("candle_lotus");
    expect(seasonalSeedOn("2026-12-01")).toBe("snow_strawberry");
    // A month without a crop yet: nothing on offer.
    expect(seasonOn("2026-10-03").crop).toBeNull();
    expect(seasonalSeedOn("2026-10-03")).toBeNull();
    expect(seasonalMarketOn("2026-10-20")).toBeNull();
  });

  it("×1.5 only for that month's crop during its market", () => {
    expect(SEASON_SELL_MULT).toBe(1.5);
    expect(seasonPriceMult("crop:candle_lotus:gold:150", "2026-11-20")).toBe(1.5);
    expect(seasonPriceMult("crop:candle_lotus", "2026-11-20")).toBe(1.5);
    expect(seasonPriceMult("crop:candle_lotus:gold:150", "2026-11-10")).toBe(1);
    expect(seasonPriceMult("crop:candle_lotus:gold:150", "2026-12-20")).toBe(1);
    expect(seasonPriceMult("crop:tomato:gold:150", "2026-11-20")).toBe(1);
    expect(seasonPriceMult("produce:egg", "2026-11-20")).toBe(1);
    // rare base 16 × 1.5 = 24; with gold, weather ×1.5, stall 1 → round(16×1.5×1.5×1.1×1.5) = 59.
    expect(sellPrice("crop:candle_lotus:normal:100", 0, 1.5)).toBe(24);
    expect(sellPrice("crop:candle_lotus:gold:150", 1, 1.5)).toBe(59);
    expect(sellPrice("crop:candle_lotus:gold:150", 1)).toBe(40);
  });

  it("the season-year: a November crop sold in January still belongs to last year's season", () => {
    expect(seasonYear("candle_lotus", "2026-11-03")).toBe(2026);
    expect(seasonYear("candle_lotus", "2026-12-31")).toBe(2026);
    expect(seasonYear("candle_lotus", "2027-01-03")).toBe(2026);
    expect(seasonYear("candle_lotus", "2027-11-01")).toBe(2027);
  });

  it("the special order: 3 of the crop for round(1.5 × 1.5 × base × 3) + 10", () => {
    expect(SEASONAL_ORDER_QTY).toBe(3);
    expect(seasonalOrderReward("candle_lotus")).toBe(118);
    expect(SEASONAL_SEED_PRICE).toBe(SEED_SHOP_PRICE[CROPS.candle_lotus.rarity]);
  });

  it("the Seed-dex crop calendar: 12 slots, the current month marked, each says when it's back", () => {
    const cal = cropCalendar("2026-11-12");
    expect(cal).toHaveLength(12);
    expect(cal.filter((s) => s.current).map((s) => s.month)).toEqual([11]);
    expect(cal[10]).toEqual({ month: 11, crop: "candle_lotus", current: true, returns: "2026-11-01" });
    expect(cal[11]).toMatchObject({ crop: "snow_strawberry", returns: "2026-12-01" });
    expect(cal[0]).toEqual({ month: 1, crop: null, current: false, returns: "2027-01-01" });
    expect(cal.filter((s) => s.crop === null)).toHaveLength(10);
    // Missed it? It comes back next year.
    expect(cropCalendar("2026-12-02")[10]!.returns).toBe("2027-11-01");
  });

  it("seasonal crops never come from the capsule machine", () => {
    for (const id of CROP_IDS.filter((c) => CROPS[c].seasonal)) expect(GACHA_CROP_IDS).not.toContain(id);
    for (let i = 0; i < 400; i++) {
      const out = roll(NO_PITY, i / 400, ((i * 7) % 400) / 400);
      expect(CROPS[out.cropId].seasonal).toBe(false);
    }
  });
});

describe("seasonal SQL mirrors content/seasonal.ts", () => {
  const sql = readFileSync("supabase/migrations/20261113100000_seasonal.sql", "utf8");
  it("calendar, planting days, multiplier, seed price, order", () => {
    const cal = sql.match(/function public\._season_crop[\s\S]*?\$\$;/)![0];
    const fromSql = Object.fromEntries(
      [...cal.matchAll(/when (\d+) then '([a-z_]+)'/g)].map((m) => [Number(m[1]), m[2]]),
    );
    expect(fromSql).toEqual(SEASONAL_CALENDAR);
    expect(sql).toContain(`extract(day from p_day) <= ${PLANTING_DAYS}`);
    expect(sql).toContain(`extract(day from p_day) > ${PLANTING_DAYS}`);
    expect(sql).toContain(`then ${SEASON_SELL_MULT} else 1 end::numeric`);
    expect(sql).toContain(`'price', ${SEASONAL_SEED_PRICE})`);
    expect(sql).toContain(`price := ${SEASONAL_SEED_PRICE};`);
    expect(sql).toContain(
      `round(1.5 * ${SEASON_SELL_MULT} * public._sell_base(public._crop_rarity(p_crop)) * ${SEASONAL_ORDER_QTY}) + 10`,
    );
    expect(sql).toContain(`need integer := ${SEASONAL_ORDER_QTY};`);
  });
});
