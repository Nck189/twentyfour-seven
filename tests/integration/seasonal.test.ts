import { describe, expect, it } from "vitest";
import { CROP_IDS, CROPS } from "@/content/crops";
import { QUALITIES } from "@/content/game";
import { SEASONAL_CALENDAR, SEASONAL_SEED_PRICE } from "@/content/seasonal";
import { sellPrice } from "@/lib/game/market";
import { seasonPriceMult, seasonYear, seasonalOrderReward } from "@/lib/game/seasonal";
import { admin, anon, newUser } from "./helpers";

/**
 * Seasonal crops (docs/STORY.md): every price, offer and gift is the server's, and the SQL
 * mirrors content/seasonal.ts + lib/game/seasonal.ts. The test clock (`season_clock`, service
 * role only) stands a user on any day of the calendar.
 */
const SEASONAL = CROP_IDS.filter((c) => CROPS[c].seasonal);
const wallet = async (id: string) =>
  (await admin().from("game_state").select("coins, tickets").eq("user_id", id).single()).data as {
    coins: number;
    tickets: number;
  };
const qty = async (id: string, item: string) =>
  ((await admin().from("inventory").select("qty").eq("user_id", id).eq("item_id", item).maybeSingle()).data
    ?.qty as number | undefined) ?? 0;
const give = (id: string, item_id: string, n: number) =>
  admin().from("inventory").upsert({ user_id: id, item_id, qty: n }, { onConflict: "user_id,item_id" });
const setCoins = (id: string, n: number) => admin().from("game_state").update({ coins: n }).eq("user_id", id);
const clock = (id: string, today: string) =>
  admin().from("season_clock").upsert({ user_id: id, today }, { onConflict: "user_id" });

describe("seasonal SQL = TS", () => {
  it("calendar, ×1.5 multiplier and season-year on every day class of the year", async () => {
    for (let m = 1; m <= 12; m++)
      expect((await admin().rpc("_season_crop", { p_month: m })).data).toBe(SEASONAL_CALENDAR[m] ?? null);
    const items = [
      ...SEASONAL.map((c) => `crop:${c}:gold:150`),
      "crop:candle_lotus",
      "crop:tomato:normal:100",
      "produce:egg",
    ];
    const days: string[] = [];
    for (const y of [2026, 2027])
      for (let m = 1; m <= 12; m++)
        for (const d of [1, 14, 15, 28])
          days.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    const checks = days.flatMap((day) => items.map((item) => ({ day, item })));
    for (let k = 0; k < checks.length; k += 25) {
      const batch = checks.slice(k, k + 25);
      const r = await Promise.all(
        batch.map((c) => admin().rpc("_season_mult", { p_item: c.item, p_day: c.day })),
      );
      batch.forEach((c, i) => expect([c, Number(r[i]!.data)]).toEqual([c, seasonPriceMult(c.item, c.day)]));
      const y = await Promise.all(
        batch.map((c) => admin().rpc("_season_year", { p_crop: "candle_lotus", p_day: c.day })),
      );
      batch.forEach((c, i) =>
        expect([c.day, y[i]!.data]).toEqual([c.day, seasonYear("candle_lotus", c.day)]),
      );
    }
  });

  it("prices: every seasonal crop × quality × weather × stall × season, and the special order", async () => {
    const cases = SEASONAL.flatMap((c) => [
      `crop:${c}`,
      ...QUALITIES.flatMap((q) => [100, 150, 300, 450, 9000].map((w) => `crop:${c}:${q}:${w}`)),
    ]).flatMap((item) => [0, 1, 2].flatMap((stall) => [1, 1.5].map((season) => ({ item, stall, season }))));
    for (let k = 0; k < cases.length; k += 25) {
      const batch = cases.slice(k, k + 25);
      const r = await Promise.all(
        batch.map((c) =>
          admin().rpc("_sell_price", { p_item: c.item, p_stall: c.stall, p_season: c.season }),
        ),
      );
      batch.forEach((c, i) => expect([c, r[i]!.data]).toEqual([c, sellPrice(c.item, c.stall, c.season)]));
    }
    for (const c of SEASONAL)
      expect((await admin().rpc("_season_order_coins", { p_crop: c })).data).toBe(seasonalOrderReward(c));
  });
});

describe("seasonal shop, market and order (server)", () => {
  it("planting season: the seasonal seed is in the seed shop for 80; not after day 14", async () => {
    const u = await newUser("ss-seed");
    await setCoins(u.id, 200);
    await clock(u.id, "2026-11-03");
    const s = (await u.client.rpc("season_status")).data;
    expect(s).toMatchObject({
      today: "2026-11-03",
      crop: "candle_lotus",
      phase: "planting",
      seed: { crop: "candle_lotus", price: SEASONAL_SEED_PRICE },
      mult: 1,
      order: null,
    });
    expect((await u.client.rpc("buy_seed", { p_crop: "candle_lotus" })).error).toBeNull();
    expect((await wallet(u.id)).coins).toBe(200 - SEASONAL_SEED_PRICE);
    expect(await qty(u.id, "seed:candle_lotus")).toBe(1);
    // Next month's crop isn't on sale yet; the seed is gone on day 15.
    expect((await u.client.rpc("buy_seed", { p_crop: "snow_strawberry" })).error?.code).toBe("22023");
    await clock(u.id, "2026-11-15");
    expect((await u.client.rpc("season_status")).data.seed).toBeNull();
    expect((await u.client.rpc("buy_seed", { p_crop: "candle_lotus" })).error?.code).toBe("22023");
    // A bought seasonal seed plants like any other seed (it's in the catalog the server knows).
    const planted = await u.client.rpc("plant_seed", { p_slot: "focus", p_crop: "candle_lotus" });
    expect(planted.error).toBeNull();
    expect(planted.data).toMatchObject({ crop_id: "candle_lotus" });
  });

  it("seasonal market: ×1.5 on the shelf and at the sale, only for that crop, only from day 15", async () => {
    const u = await newUser("ss-sell");
    await setCoins(u.id, 0);
    await give(u.id, "crop:candle_lotus:normal:100", 3);
    await give(u.id, "crop:pumpkin:normal:100", 1);
    await clock(u.id, "2026-11-10");
    const before = (await u.client.rpc("market_status")).data.shelf as { item: string; price: number }[];
    expect(before.find((x) => x.item === "crop:candle_lotus:normal:100")).toMatchObject({
      price: 16,
      season: 1,
    });
    await clock(u.id, "2026-11-20");
    const shelf = (await u.client.rpc("market_status")).data.shelf as { item: string; price: number }[];
    expect(shelf.find((x) => x.item === "crop:candle_lotus:normal:100")).toMatchObject({
      price: 24,
      season: 1.5,
    });
    expect(shelf.find((x) => x.item === "crop:pumpkin:normal:100")).toMatchObject({ price: 16, season: 1 });
    const r = await u.client.rpc("sell_produce", { p_item: "crop:candle_lotus:normal:100", p_qty: 1 });
    expect(r.error).toBeNull();
    expect(r.data).toMatchObject({ earned: 24, coins: 24 });
    expect((await u.client.rpc("season_status")).data).toMatchObject({ phase: "market", mult: 1.5 });
  });

  it("the special order: 3 for 118, lowest quality first, once per year, only in the market", async () => {
    const u = await newUser("ss-order");
    await setCoins(u.id, 0);
    await clock(u.id, "2026-11-10");
    expect((await u.client.rpc("deliver_seasonal_order")).error?.code).toBe("P0001");
    await clock(u.id, "2026-11-20");
    expect((await u.client.rpc("season_status")).data.order).toEqual({
      crop: "candle_lotus",
      qty: 3,
      coins: 118,
      done: false,
    });
    await give(u.id, "crop:candle_lotus:gold:100", 2);
    // Not enough: refused, and nothing is recorded or taken.
    expect((await u.client.rpc("deliver_seasonal_order")).error?.code).toBe("P0001");
    expect(await qty(u.id, "crop:candle_lotus:gold:100")).toBe(2);
    await give(u.id, "crop:candle_lotus:normal:100", 2);
    const tries = await Promise.all([1, 2, 3].map(() => u.client.rpc("deliver_seasonal_order")));
    expect(tries.filter((t) => !t.error)).toHaveLength(1);
    expect((await wallet(u.id)).coins).toBe(118);
    expect(await qty(u.id, "crop:candle_lotus:normal:100")).toBe(0);
    expect(await qty(u.id, "crop:candle_lotus:gold:100")).toBe(1);
    expect((await u.client.rpc("season_status")).data.order.done).toBe(true);
    // Next year's market has a fresh order.
    await clock(u.id, "2027-11-16");
    expect((await u.client.rpc("season_status")).data.order.done).toBe(false);
  });

  it("daily orders never ask for a seasonal crop", async () => {
    const u = await newUser("ss-daily");
    await admin()
      .from("events")
      .insert(SEASONAL.map((crop) => ({ user_id: u.id, type: "harvest", payload: { crop } })));
    await admin().from("upgrades").insert({ user_id: u.id, track: "barn", level: 2 });
    const orders = (await u.client.rpc("market_status")).data.orders as { crop: string }[];
    expect(orders).toHaveLength(3);
    for (const o of orders) expect(CROPS[o.crop as keyof typeof CROPS].seasonal).toBe(false);
  });

  it("clients can't set the clock, write orders or read anyone else's", async () => {
    const u = await newUser("ss-rls");
    await u.client.from("season_clock").insert({ user_id: u.id, today: "2026-11-20" });
    expect((await admin().from("season_clock").select("*").eq("user_id", u.id)).data).toEqual([]);
    await u.client
      .from("seasonal_orders")
      .insert({ user_id: u.id, crop_id: "candle_lotus", year: 2026, qty: 3, coins: 999 });
    expect((await admin().from("seasonal_orders").select("*").eq("user_id", u.id)).data).toEqual([]);
    expect((await anon().rpc("season_status")).error).not.toBeNull();
    expect((await anon().rpc("deliver_seasonal_order")).error).not.toBeNull();
  });
});
