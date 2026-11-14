import { describe, expect, it } from "vitest";
import { MACHINE_IDS, MACHINES, PRODUCT_IDS, QUEUE_CAPACITY, RECIPES, SPEED_FACTOR } from "@/content/factory";
import { sellPrice } from "@/lib/game/market";
import { admin, anon, newUser } from "./helpers";

/** M13 factory (SPEC §9): the server owns the clock, the stock and every coin. */
const coins = async (id: string) =>
  ((await admin().from("game_state").select("coins").eq("user_id", id).single()).data as { coins: number })
    .coins;
const setCoins = (id: string, n: number) => admin().from("game_state").update({ coins: n }).eq("user_id", id);
const give = (id: string, item_id: string, qty: number) =>
  admin().from("inventory").upsert({ user_id: id, item_id, qty }, { onConflict: "user_id,item_id" });
const stock = async (id: string) =>
  Object.fromEntries(
    ((await admin().from("inventory").select("item_id, qty").eq("user_id", id)).data ?? []).map(
      (r: { item_id: string; qty: number }) => [r.item_id, r.qty],
    ),
  ) as Record<string, number>;
type Job = {
  id: string;
  start_at: string;
  ready_at: string;
  created_at: string;
  collected_at: string | null;
};
const jobs = async (id: string) =>
  ((await admin().from("production_jobs").select("*").eq("user_id", id).order("start_at")).data ??
    []) as Job[];
/** Moves every job of a user `min` minutes into the past (the clock "passes"). */
async function passMinutes(id: string, min: number) {
  for (const j of await jobs(id)) {
    const back = (iso: string) => new Date(new Date(iso).getTime() - min * 60_000).toISOString();
    await admin()
      .from("production_jobs")
      .update({ created_at: back(j.created_at), start_at: back(j.start_at), ready_at: back(j.ready_at) })
      .eq("id", j.id);
  }
}
const mins = (j: Job) => (new Date(j.ready_at).getTime() - new Date(j.start_at).getTime()) / 60_000;

describe("factory catalog: SQL = content/factory.ts", () => {
  it("machines, upgrade prices, recipes and product prices match", async () => {
    const { data, error } = await admin().rpc("_factory_catalog");
    expect(error).toBeNull();
    const cat = data as {
      speed_factor: number[];
      capacity: number[];
      machines: Record<string, { price: number; speed: number[]; capacity: number[] }>;
      recipes: Record<
        string,
        { machine: string; minutes: number; price: number; inputs: { item: string; qty: number }[] }
      >;
    };
    expect(cat.speed_factor).toEqual([...SPEED_FACTOR]);
    expect(cat.capacity).toEqual([...QUEUE_CAPACITY]);
    expect(Object.keys(cat.machines).sort()).toEqual([...MACHINE_IDS].sort());
    for (const m of MACHINE_IDS)
      expect(cat.machines[m]).toEqual({
        price: MACHINES[m].price,
        speed: [...MACHINES[m].speedPrices],
        capacity: [...MACHINES[m].capacityPrices],
      });
    expect(Object.keys(cat.recipes).sort()).toEqual([...PRODUCT_IDS].sort());
    for (const p of PRODUCT_IDS) {
      const r = RECIPES[p];
      expect(cat.recipes[p]).toEqual({
        machine: r.machine,
        minutes: r.minutes,
        price: r.price,
        inputs: r.inputs.map((i) => ({
          item: "crop" in i ? `crop:${i.crop}` : `produce:${i.produce}`,
          qty: i.qty,
        })),
      });
      for (const stall of [0, 1, 2])
        expect((await admin().rpc("_sell_price", { p_item: `product:${p}`, p_stall: stall })).data).toBe(
          sellPrice(`product:${p}`, stall),
        );
    }
    expect((await admin().rpc("_sell_price", { p_item: "product:nope", p_stall: 0 })).data).toBeNull();
  });
});

describe("factory actions (server)", () => {
  it("build: costs coins once; can't build without coins or twice", async () => {
    const u = await newUser("fx-buy");
    await setCoins(u.id, 100);
    expect((await u.client.rpc("buy_machine", { p_machine: "jam_jar" })).error?.code).toBe("P0001");
    expect(await coins(u.id)).toBe(100);
    await setCoins(u.id, 200);
    expect((await u.client.rpc("buy_machine", { p_machine: "jam_jar" })).error).toBeNull();
    expect(await coins(u.id)).toBe(50);
    expect((await u.client.rpc("buy_machine", { p_machine: "jam_jar" })).error?.code).toBe("P0001");
    expect((await u.client.rpc("buy_machine", { p_machine: "rocket" })).error?.code).toBe("22023");
    expect((await anon().rpc("buy_machine", { p_machine: "loom" })).error).not.toBeNull();
    // No client writes to the tables.
    expect(
      (await u.client.from("machines").insert({ user_id: u.id, machine_id: "bakery" })).error,
    ).not.toBeNull();
    expect(
      (await u.client.from("machines").update({ speed_level: 2 }).eq("user_id", u.id).select()).data ?? [],
    ).toEqual([]);
  });

  it("a job takes its inputs (lowest quality first), queues behind the last one, and only pays out when collected", async () => {
    const u = await newUser("fx-job");
    await setCoins(u.id, 150);
    await u.client.rpc("buy_machine", { p_machine: "jam_jar" });
    // Not on this machine / no machine / not enough: refused, nothing taken.
    expect((await u.client.rpc("start_job", { p_machine: "jam_jar", p_recipe: "cheese" })).error?.code).toBe(
      "22023",
    );
    expect((await u.client.rpc("start_job", { p_machine: "loom", p_recipe: "yarn" })).error?.code).toBe(
      "P0002",
    );
    await give(u.id, "crop:radish:gold:150", 1);
    await give(u.id, "crop:radish:normal:100", 3);
    await give(u.id, "crop:turnip", 3);
    await give(u.id, "crop:turnip:silver:100", 1);
    expect(
      (await u.client.rpc("start_job", { p_machine: "jam_jar", p_recipe: "strawberry_jam" })).error?.code,
    ).toBe("P0001");
    // Job 1: takes the 2 normal radishes and the 2 plain turnips (lowest first), keeps the gold one.
    const j1 = await u.client.rpc("start_job", { p_machine: "jam_jar", p_recipe: "pickles" });
    expect(j1.error).toBeNull();
    let s = await stock(u.id);
    expect(s["crop:radish:gold:150"]).toBe(1);
    expect(s["crop:radish:normal:100"]).toBe(1);
    expect(s["crop:turnip"]).toBe(1);
    expect(s["crop:turnip:silver:100"]).toBe(1);
    // Job 2 waits for job 1; the queue (capacity 2) is then full.
    expect((await u.client.rpc("start_job", { p_machine: "jam_jar", p_recipe: "pickles" })).error).toBeNull();
    const [a, b] = await jobs(u.id);
    expect(mins(a)).toBe(20);
    expect(b.start_at).toBe(a.ready_at);
    await give(u.id, "crop:radish:normal:100", 4);
    await give(u.id, "crop:turnip", 4);
    expect((await u.client.rpc("start_job", { p_machine: "jam_jar", p_recipe: "pickles" })).error?.code).toBe(
      "P0001",
    );
    // Nothing is ready yet: collecting gives nothing.
    expect((await u.client.rpc("collect_jobs", { p_machine: null })).data).toMatchObject({ n: 0 });
    // 25 minutes later: job 1 is ready, job 2 still running.
    await passMinutes(u.id, 25);
    expect((await u.client.rpc("collect_jobs", { p_machine: "jam_jar" })).data).toEqual({
      collected: { pickles: 1 },
      n: 1,
    });
    s = await stock(u.id);
    expect(s["product:pickles"]).toBe(1);
    // A collected job frees a slot.
    expect((await u.client.rpc("start_job", { p_machine: "jam_jar", p_recipe: "pickles" })).error).toBeNull();
    // Sell the product at the market price.
    await setCoins(u.id, 0);
    expect((await u.client.rpc("sell_produce", { p_item: "product:pickles", p_qty: 1 })).error).toBeNull();
    expect(await coins(u.id)).toBe(34);
    // The client can't move a job's clock.
    const mine = await jobs(u.id);
    expect(
      (
        await u.client
          .from("production_jobs")
          .update({ ready_at: new Date(0).toISOString() })
          .eq("id", mine[2].id)
          .select()
      ).data ?? [],
    ).toEqual([]);
    const ev = await u.client.from("events").select("type").in("type", ["job_started", "jobs_collected"]);
    expect(ev.data?.length).toBeGreaterThanOrEqual(4);
    expect(
      (await u.client.from("events").insert({ user_id: u.id, type: "jobs_collected", payload: {} })).error,
    ).not.toBeNull();
  });

  it("upgrades: speed shortens new jobs, capacity adds a slot; top level and coins are enforced", async () => {
    const u = await newUser("fx-up");
    await setCoins(u.id, 250 + 250 + 200 + 600 + 450);
    await u.client.rpc("buy_machine", { p_machine: "cheese_press" });
    expect(
      (await u.client.rpc("upgrade_machine", { p_machine: "cheese_press", p_track: "turbo" })).error?.code,
    ).toBe("22023");
    expect((await u.client.rpc("upgrade_machine", { p_machine: "loom", p_track: "speed" })).error?.code).toBe(
      "P0002",
    );
    expect(
      (await u.client.rpc("upgrade_machine", { p_machine: "cheese_press", p_track: "speed" })).data,
    ).toMatchObject({
      level: 1,
    });
    expect(
      (await u.client.rpc("upgrade_machine", { p_machine: "cheese_press", p_track: "capacity" })).error,
    ).toBeNull();
    expect(
      (await u.client.rpc("upgrade_machine", { p_machine: "cheese_press", p_track: "speed" })).error,
    ).toBeNull();
    expect(await coins(u.id)).toBe(450);
    expect(
      (await u.client.rpc("upgrade_machine", { p_machine: "cheese_press", p_track: "speed" })).error?.code,
    ).toBe("P0001");
    await give(u.id, "produce:milk", 9);
    for (let i = 0; i < 3; i++)
      expect(
        (await u.client.rpc("start_job", { p_machine: "cheese_press", p_recipe: "cheese" })).error,
      ).toBeNull();
    expect(
      (await u.client.rpc("start_job", { p_machine: "cheese_press", p_recipe: "cheese" })).error?.code,
    ).toBe("P0001");
    const js = await jobs(u.id);
    expect(js.map(mins)).toEqual([39, 39, 39]);
    // Others see nothing.
    const other = await newUser("fx-other");
    expect((await other.client.from("production_jobs").select("id")).data).toEqual([]);
    expect((await other.client.from("machines").select("machine_id")).data).toEqual([]);
  });
});
