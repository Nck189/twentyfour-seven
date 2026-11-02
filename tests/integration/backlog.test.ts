import { describe, expect, it } from "vitest";
import { COINS_BY_PRIORITY } from "@/content/economy";
import { newUser } from "./helpers";

async function addItem(u: Awaited<ReturnType<typeof newUser>>, priority: "must" | "should" | "just_start") {
  const { data, error } = await u.client
    .from("backlog_items")
    .insert({ user_id: u.id, title: `t-${priority}`, priority })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}
const coins = async (u: Awaited<ReturnType<typeof newUser>>) =>
  (await u.client.from("game_state").select("coins").single()).data!.coins as number;

describe("complete_backlog_item (M5 coins, server-side)", () => {
  it("grants Must > Should > Just start, matching content/economy.ts", async () => {
    const u = await newUser("backlog-coins");
    for (const p of ["must", "should", "just_start"] as const) {
      const id = await addItem(u, p);
      const { data, error } = await u.client.rpc("complete_backlog_item", { p_id: id });
      expect(error).toBeNull();
      expect(data.coins_granted).toBe(COINS_BY_PRIORITY[p]);
    }
    expect(await coins(u)).toBe(
      COINS_BY_PRIORITY.must + COINS_BY_PRIORITY.should + COINS_BY_PRIORITY.just_start,
    );
    const { data: item } = await u.client.from("backlog_items").select("status, done_at").limit(1).single();
    expect(item).toMatchObject({ status: "done" });
    expect(item!.done_at).toBeTruthy();
  });

  it("pays once per item: reopen and finish again, or concurrent calls, earn nothing more", async () => {
    const u = await newUser("backlog-once");
    const id = await addItem(u, "must");
    const results = await Promise.all(
      Array.from({ length: 4 }, () => u.client.rpc("complete_backlog_item", { p_id: id })),
    );
    expect(results.every((r) => r.error === null)).toBe(true);
    expect(results.filter((r) => r.data.coins_granted > 0)).toHaveLength(1);
    await u.client.from("backlog_items").update({ status: "scheduled", done_at: null }).eq("id", id);
    const again = await u.client.rpc("complete_backlog_item", { p_id: id });
    expect(again.data.coins_granted).toBe(0);
    expect(await coins(u)).toBe(COINS_BY_PRIORITY.must);
  });

  it("clients can't touch coins or the ledger, or finish someone else's item", async () => {
    const a = await newUser("backlog-a");
    const b = await newUser("backlog-b");
    const id = await addItem(a, "should");
    const theft = await b.client.rpc("complete_backlog_item", { p_id: id });
    expect(theft.error).not.toBeNull();
    const ins = await a.client
      .from("coin_grants")
      .insert({ user_id: a.id, reason: "backlog_done", ref: "x", amount: 999 });
    expect(ins.error?.code).toBe("42501");
    await a.client.from("game_state").update({ coins: 9999 }).eq("user_id", a.id);
    expect(await coins(a)).toBe(0);
    const ev = await a.client.from("events").insert({ user_id: a.id, type: "coins_granted", payload: {} });
    expect(ev.error).not.toBeNull();
  });
});
