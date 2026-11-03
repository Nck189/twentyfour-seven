import { describe, expect, it } from "vitest";
import { PITY } from "@/content/gacha";
import { roll, type Pity } from "@/lib/game/gacha";
import { admin, newUser } from "./helpers";

/** M7 seed capsule machine: server rolls = lib/game, pity holds over 100k pulls, pulls are safe. */
describe("_gacha_roll (SQL) = lib/game roll", () => {
  it("same rarity, crop and pity for 300 random inputs", async () => {
    for (let i = 0; i < 300; i++) {
      const p: Pity = {
        since_rare: Math.floor(Math.random() * 10),
        since_epic: Math.floor(Math.random() * 30),
        since_legendary: Math.floor(Math.random() * 80),
      };
      const r = Math.random();
      const c = Math.random();
      const { data, error } = await admin().rpc("_gacha_roll", { p, r, c });
      expect(error).toBeNull();
      const ts = roll(p, r, c);
      expect(data).toEqual({ rarity: ts.rarity, crop: ts.cropId, pity: ts.pity });
    }
  });
  it("100k pulls in SQL: pity never exceeded, rates as designed", async () => {
    const { data, error } = await admin().rpc("_gacha_simulate", { p_n: 100_000 });
    expect(error).toBeNull();
    expect(data.max_since_rare).toBeLessThanOrEqual(PITY.rare - 1);
    expect(data.max_since_epic).toBeLessThanOrEqual(PITY.epic - 1);
    expect(data.max_since_legendary).toBeLessThanOrEqual(PITY.legendary - 1);
    const share = (k: string) => data.counts[k] / 100_000;
    expect(share("common")).toBeGreaterThan(0.53);
    expect(share("common")).toBeLessThan(0.58);
    expect(share("legendary")).toBeGreaterThan(0.012);
    expect(share("legendary")).toBeLessThan(0.024);
  });
});

describe("pull_gacha / star_up / planting owned seeds", () => {
  it("charges tickets atomically, once per key, and gives seeds + Seed-dex", async () => {
    const u = await newUser("gacha");
    await admin().from("game_state").update({ tickets: 12 }).eq("user_id", u.id);
    const a = await u.client.rpc("pull_gacha", { p_n: 10, p_key: "key-aaaa-1" });
    expect(a.error).toBeNull();
    expect(a.data.results).toHaveLength(10);
    expect(a.data.tickets).toBe(2);
    const again = await u.client.rpc("pull_gacha", { p_n: 10, p_key: "key-aaaa-1" });
    expect(again.data).toMatchObject({ repeat: true, tickets: 2 });
    expect(again.data.results.map((r: { crop: string }) => r.crop)).toEqual(
      a.data.results.map((r: { crop: string }) => r.crop),
    );
    expect((await u.client.rpc("pull_gacha", { p_n: 10, p_key: "key-bbbb-2" })).error?.code).toBe("P0001");
    expect((await u.client.rpc("pull_gacha", { p_n: 3, p_key: "key-cccc-3" })).error?.code).toBe("22023");
    const { data: inv } = await u.client.from("inventory").select("qty").like("item_id", "seed:%");
    expect(inv!.reduce((n, r) => n + r.qty, 0)).toBe(10);
    const { data: dex } = await u.client.from("seed_dex").select("count");
    expect(dex!.reduce((n, r) => n + r.count, 0)).toBe(10);
    // Client can't give itself tickets or fake a pull.
    await u.client.from("game_state").update({ tickets: 999 }).eq("user_id", u.id);
    expect(
      (await admin().from("game_state").select("tickets").eq("user_id", u.id).single()).data!.tickets,
    ).toBe(2);
    expect(
      (await u.client.from("events").insert({ user_id: u.id, type: "gacha_pull", payload: {} })).error?.code,
    ).toBe("42501");
  });

  it("two ×1 pulls racing with one ticket: exactly one goes through", async () => {
    const u = await newUser("gacha-race");
    await admin().from("game_state").update({ tickets: 1 }).eq("user_id", u.id);
    const both = await Promise.all([
      u.client.rpc("pull_gacha", { p_n: 1, p_key: "race-key-1" }),
      u.client.rpc("pull_gacha", { p_n: 1, p_key: "race-key-2" }),
    ]);
    expect(both.filter((x) => x.error === null)).toHaveLength(1);
  });

  it("star-up spends that crop's shards; an owned seed plants (and is used up), one you don't own doesn't", async () => {
    const u = await newUser("starup");
    await admin().from("seed_dex").insert({ user_id: u.id, crop_id: "pumpkin" });
    await admin()
      .from("game_state")
      .update({ essence: { pumpkin: 6 } })
      .eq("user_id", u.id);
    await admin().from("inventory").insert({ user_id: u.id, item_id: "seed:pumpkin", qty: 1 });
    const up = await u.client.rpc("star_up", { p_crop: "pumpkin" });
    expect(up.data).toMatchObject({ star: 2, shards_left: 1 });
    expect((await u.client.rpc("star_up", { p_crop: "pumpkin" })).error?.code).toBe("P0001");
    const planted = await u.client.rpc("plant_seed", { p_slot: "focus", p_crop: "pumpkin" });
    expect(planted.data).toMatchObject({ crop_id: "pumpkin", star: 2 });
    expect((await u.client.rpc("plant_seed", { p_slot: "work", p_crop: "pumpkin" })).error?.code).toBe(
      "42501",
    );
    expect((await u.client.rpc("plant_seed", { p_slot: "work", p_crop: "moon_melon" })).error?.code).toBe(
      "42501",
    );
  });
});
