import { describe, expect, it } from "vitest";
import { CROP_IDS } from "@/content/crops";
import { PRODUCE_IDS } from "@/content/animals";
import { QUALITIES } from "@/content/game";
import { sellPrice, orderReward } from "@/lib/game/market";
import { admin, anon, newUser } from "./helpers";

/** Economy v2 step 2 (docs/ECONOMY.md): every coin and ticket change is the server's. */
const coins = async (id: string) =>
  (await admin().from("game_state").select("coins, tickets").eq("user_id", id).single()).data as {
    coins: number;
    tickets: number;
  };
const give = (id: string, item_id: string, qty: number) =>
  admin().from("inventory").upsert({ user_id: id, item_id, qty }, { onConflict: "user_id,item_id" });
const setCoins = (id: string, n: number) => admin().from("game_state").update({ coins: n }).eq("user_id", id);

describe("prices: SQL = content/economy.ts", () => {
  it("every crop × quality × weather × stall, and animal produce", async () => {
    const items = [
      ...CROP_IDS.flatMap((c) => [
        `crop:${c}`,
        ...QUALITIES.flatMap((q) => [100, 150, 300, 450, 9000].map((m) => `crop:${c}:${q}:${m}`)),
      ]),
      ...PRODUCE_IDS.map((p) => `produce:${p}`),
      "seed:corn",
      "crop:nope:gold:100",
    ];
    for (const stall of [0, 1, 2]) {
      // In batches: hundreds of requests at once overwhelm the local API.
      const sql: unknown[] = [];
      for (let k = 0; k < items.length; k += 25) {
        const batch = await Promise.all(
          items.slice(k, k + 25).map((i) => admin().rpc("_sell_price", { p_item: i, p_stall: stall })),
        );
        for (const r of batch) {
          expect(r.error).toBeNull();
          sql.push(r.data);
        }
      }
      expect(sql).toEqual(items.map((i) => sellPrice(i, stall)));
    }
  });
});

describe("market actions (server)", () => {
  it("sells produce for coins; can't sell more than you have; the client can't set the price", async () => {
    const u = await newUser("mk-sell");
    await setCoins(u.id, 0);
    await give(u.id, "crop:tomato:gold:300", 3);
    const r = await u.client.rpc("sell_produce", { p_item: "crop:tomato:gold:300", p_qty: 2 });
    expect(r.error).toBeNull();
    expect(r.data).toMatchObject({ earned: 90, coins: 90 });
    expect(
      (await u.client.rpc("sell_produce", { p_item: "crop:tomato:gold:300", p_qty: 2 })).error?.code,
    ).toBe("P0001");
    expect((await u.client.rpc("sell_produce", { p_item: "seed:corn", p_qty: 1 })).error?.code).toBe("22023");
    // Inventory and coins aren't writable by the user.
    await u.client.from("inventory").update({ qty: 99 }).eq("user_id", u.id);
    await u.client.from("game_state").update({ coins: 9999 }).eq("user_id", u.id);
    expect((await coins(u.id)).coins).toBe(90);
    expect(
      (await anon().rpc("sell_produce", { p_item: "crop:tomato:gold:300", p_qty: 1 })).error,
    ).not.toBeNull();
  });

  it("seed shop: only today's offers; costs coins; the seed lands in the inventory", async () => {
    const u = await newUser("mk-seed");
    await setCoins(u.id, 200);
    const s = (await u.client.rpc("market_status")).data;
    expect(s.seeds).toHaveLength(3);
    const offer = s.seeds[0] as { crop: string; price: number };
    expect(offer.price).toBe(30);
    expect((await u.client.rpc("buy_seed", { p_crop: offer.crop })).error).toBeNull();
    expect((await coins(u.id)).coins).toBe(170);
    const notOffered = ["strawberry", "blueberry", "tomato", "corn"].find(
      (c) => !s.seeds.some((x: { crop: string }) => x.crop === c),
    )!;
    expect((await u.client.rpc("buy_seed", { p_crop: notOffered })).error?.code).toBe("22023");
    expect((await u.client.rpc("buy_seed", { p_crop: "star_fruit" })).error?.code).toBe("22023");
    const inv = await admin()
      .from("inventory")
      .select("qty")
      .eq("user_id", u.id)
      .eq("item_id", `seed:${offer.crop}`)
      .single();
    expect(inv.data?.qty).toBe(1);
  });

  it("ticket exchange: 150 coins → 1 ticket, at most 2 a week, even with parallel taps", async () => {
    const u = await newUser("mk-xchg");
    await setCoins(u.id, 1000);
    const before = (await coins(u.id)).tickets;
    const tries = await Promise.all([1, 2, 3, 4].map(() => u.client.rpc("exchange_ticket")));
    expect(tries.filter((t) => !t.error)).toHaveLength(2);
    expect(await coins(u.id)).toMatchObject({ coins: 700, tickets: before + 2 });
    expect((await u.client.rpc("market_status")).data.exchange).toMatchObject({ used: 2, max: 2 });
  });

  it("upgrades: one level at a time, priced per level, capped; the stall raises sell prices", async () => {
    const u = await newUser("mk-upg");
    await setCoins(u.id, 700);
    expect((await u.client.rpc("buy_upgrade", { p_track: "stall" })).data).toMatchObject({
      level: 1,
      coins: 500,
    });
    expect((await u.client.rpc("buy_upgrade", { p_track: "stall" })).data).toMatchObject({
      level: 2,
      coins: 0,
    });
    expect((await u.client.rpc("buy_upgrade", { p_track: "stall" })).error?.code).toBe("P0001");
    expect((await u.client.rpc("buy_upgrade", { p_track: "barn" })).error?.code).toBe("P0001"); // no coins
    expect((await u.client.rpc("buy_upgrade", { p_track: "rocket" })).error?.code).toBe("22023");
    await give(u.id, "crop:radish:normal:100", 1);
    expect(
      (await u.client.rpc("sell_produce", { p_item: "crop:radish:normal:100", p_qty: 1 })).data,
    ).toMatchObject({
      earned: 7, // 6 × 1.2
    });
  });

  it("daily order: deliver once, pays the listed coins, takes the lowest quality first", async () => {
    const u = await newUser("mk-order");
    await setCoins(u.id, 0);
    const s = (await u.client.rpc("market_status")).data;
    expect(s.orders).toHaveLength(1);
    const o = s.orders[0] as { slot: number; crop: string; qty: number; coins: number; done: boolean };
    expect(o.coins).toBe(orderReward(o.crop as never, o.qty));
    expect((await u.client.rpc("deliver_order", { p_slot: 0 })).error?.code).toBe("P0001"); // no produce
    await give(u.id, `crop:${o.crop}:gold:100`, 5);
    await give(u.id, `crop:${o.crop}:normal:100`, 1);
    const d = await u.client.rpc("deliver_order", { p_slot: 0 });
    expect(d.error).toBeNull();
    expect(d.data).toMatchObject({ earned: o.coins, coins: o.coins });
    const inv = (
      await admin().from("inventory").select("item_id, qty").eq("user_id", u.id).like("item_id", "crop:%")
    ).data as { item_id: string; qty: number }[];
    const left = Object.fromEntries(inv.map((r) => [r.item_id, r.qty]));
    expect(left[`crop:${o.crop}:normal:100`]).toBe(0); // the normal one went first
    expect(left[`crop:${o.crop}:gold:100`]).toBe(5 - (o.qty - 1));
    expect((await u.client.rpc("deliver_order", { p_slot: 0 })).error?.code).toBe("P0001");
    expect((await u.client.rpc("deliver_order", { p_slot: 1 })).error?.code).toBe("22023"); // barn Lv 0
    expect((await u.client.rpc("market_status")).data.orders[0].done).toBe(true);
  });

  it("reward jar: own rows only; redeeming spends coins, server-side", async () => {
    const a = await newUser("mk-jar-a");
    const b = await newUser("mk-jar-b");
    await setCoins(a.id, 100);
    const ins = await a.client.from("rewards").insert({ title: "ชานมไข่มุก", cost: 80 }).select().single();
    expect(ins.error).toBeNull();
    expect((await a.client.from("rewards").insert({ title: "x", cost: 5 })).error).not.toBeNull();
    expect((await b.client.from("rewards").select("*")).data).toEqual([]);
    expect((await b.client.rpc("redeem_reward", { p_id: ins.data!.id })).error?.code).toBe("P0002");
    expect((await a.client.rpc("redeem_reward", { p_id: ins.data!.id })).data).toMatchObject({ coins: 20 });
    expect((await a.client.rpc("redeem_reward", { p_id: ins.data!.id })).error?.code).toBe("P0001");
    expect((await a.client.from("reward_redemptions").select("title, cost")).data).toEqual([
      { title: "ชานมไข่มุก", cost: 80 },
    ]);
  });
});

describe("G7 ECON E1 (S1): one stock can't be paid twice", () => {
  it("delivering and selling the same produce at once: only one is paid, stock never goes below 0", async () => {
    for (let round = 0; round < 6; round++) {
      const u = await newUser(`mk-race-${round}`);
      await setCoins(u.id, 0);
      const o = (await u.client.rpc("market_status")).data.orders[0] as {
        crop: string;
        qty: number;
        coins: number;
      };
      const item = `crop:${o.crop}:normal:100`;
      await give(u.id, item, o.qty); // exactly enough for the order
      const price = (await admin().rpc("_sell_price", { p_item: item, p_stall: 0 })).data as number;
      const [d, s] = await Promise.all([
        u.client.rpc("deliver_order", { p_slot: 0 }),
        u.client.rpc("sell_produce", { p_item: item, p_qty: o.qty }),
      ]);
      const paid = [d.error ? 0 : o.coins, s.error ? 0 : price * o.qty];
      expect(paid.filter((p) => p > 0)).toHaveLength(1);
      expect((await coins(u.id)).coins).toBe(paid[0]! + paid[1]!);
      const left = (
        await admin().from("inventory").select("qty").eq("user_id", u.id).eq("item_id", item).single()
      ).data as { qty: number };
      expect(left.qty).toBe(0);
    }
  });
});

describe("G7 ECON E6: an order takes the lowest quality first, not the lowest value", () => {
  it("normal with ×3 weather goes before gold with none", async () => {
    const u = await newUser("mk-quality-first");
    const o = (await u.client.rpc("market_status")).data.orders[0] as { crop: string; qty: number };
    await give(u.id, `crop:${o.crop}:normal:300`, o.qty);
    await give(u.id, `crop:${o.crop}:gold:100`, o.qty);
    expect((await u.client.rpc("deliver_order", { p_slot: 0 })).error).toBeNull();
    const inv = (
      await admin().from("inventory").select("item_id, qty").eq("user_id", u.id).like("item_id", "crop:%")
    ).data as { item_id: string; qty: number }[];
    const left = Object.fromEntries(inv.map((r) => [r.item_id, r.qty]));
    expect(left[`crop:${o.crop}:normal:300`]).toBe(0);
    expect(left[`crop:${o.crop}:gold:100`]).toBe(o.qty);
  });
});
