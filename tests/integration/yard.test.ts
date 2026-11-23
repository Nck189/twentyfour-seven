import { describe, expect, it } from "vitest";
import { admin, newUser } from "./helpers";

/** Farm yard (docs/FARM_YARD_PLAN.md): decor has a spot (1–8) or sits in storage; moves are server-side. */
type Row = { id: string; item_id: string; spot: number | null };
const rows = async (id: string) =>
  ((await admin().from("decor").select("id, item_id, spot").eq("user_id", id).order("created_at")).data ??
    []) as Row[];

async function withCoins(name: string, coins = 1000) {
  const u = await newUser(name);
  await admin().from("game_state").update({ coins }).eq("user_id", u.id);
  return u;
}

describe("farm yard (server)", () => {
  it("bought decor takes the first free spot; with the yard full it goes to storage", async () => {
    const u = await withCoins("yard-buy", 2000);
    for (let i = 0; i < 9; i++)
      expect((await u.client.rpc("buy_decor", { p_item: "path" })).error).toBeNull();
    const r = await rows(u.id);
    expect(r.map((x) => x.spot)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, null]);
  });

  it("moves to a free spot, swaps with an occupied one, puts away and places again", async () => {
    const u = await withCoins("yard-move");
    await u.client.rpc("buy_decor", { p_item: "fence" });
    await u.client.rpc("buy_decor", { p_item: "flowers" });
    let [fence, flowers] = await rows(u.id);
    expect([fence!.spot, flowers!.spot]).toEqual([1, 2]);
    // To a free spot.
    expect((await u.client.rpc("place_decor", { p_id: fence!.id, p_spot: 5 })).error).toBeNull();
    // Onto an occupied spot: the two swap.
    expect((await u.client.rpc("place_decor", { p_id: flowers!.id, p_spot: 5 })).error).toBeNull();
    [fence, flowers] = await rows(u.id);
    expect([fence!.spot, flowers!.spot]).toEqual([2, 5]);
    // Put away, then place from storage onto an occupied spot: the one there goes to storage.
    expect((await u.client.rpc("store_decor", { p_id: fence!.id })).error).toBeNull();
    expect((await rows(u.id))[0]!.spot).toBeNull();
    expect((await u.client.rpc("place_decor", { p_id: fence!.id, p_spot: 5 })).error).toBeNull();
    [fence, flowers] = await rows(u.id);
    expect([fence!.spot, flowers!.spot]).toEqual([5, null]);
    // Nothing is ever deleted.
    expect(await rows(u.id)).toHaveLength(2);
  });

  it("refuses someone else's decor, a spot outside 1–8, and direct writes to the spot", async () => {
    const a = await withCoins("yard-a");
    const b = await withCoins("yard-b");
    await a.client.rpc("buy_decor", { p_item: "fence" });
    const [mine] = await rows(a.id);
    expect((await b.client.rpc("place_decor", { p_id: mine!.id, p_spot: 3 })).error?.code).toBe("P0001");
    expect((await b.client.rpc("store_decor", { p_id: mine!.id })).error?.code).toBe("P0001");
    expect((await a.client.rpc("place_decor", { p_id: mine!.id, p_spot: 9 })).error?.code).toBe("22023");
    expect((await a.client.rpc("place_decor", { p_id: mine!.id, p_spot: 0 })).error?.code).toBe("22023");
    await a.client.from("decor").update({ spot: 7 }).eq("id", mine!.id);
    expect((await rows(a.id))[0]!.spot).toBe(1);
  });
});
