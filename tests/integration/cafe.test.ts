import { describe, expect, it } from "vitest";
import { CARD_REWARD, CARD_SIZE, DRINKS } from "@/content/cafe";
import { admin, anon, newUser } from "./helpers";

/** Som's café (docs/STORY.md): orders, stamps, card rewards, and the real-life answers (server). */
const houseAt = (id: string, level: number) =>
  admin().from("upgrades").upsert({ user_id: id, track: "house", level }, { onConflict: "user_id,track" });
const state = async (id: string) =>
  (await admin().from("game_state").select("coins").eq("user_id", id).single()).data as { coins: number };

describe("Som's café (server)", () => {
  it("SQL knows the same drinks and card size", async () => {
    for (const d of DRINKS) expect((await admin().rpc("_cafe_drink_ok", { p_drink: d })).data).toBe(true);
    expect((await admin().rpc("_cafe_drink_ok", { p_drink: "beer" })).data).toBe(false);
    expect((await admin().rpc("_cafe_card_size")).data).toBe(CARD_SIZE);
  });

  it("opens with the Farmhouse at level 2; a stamp per order; the first full card gives the café table, later ones coins", async () => {
    const u = await newUser("cafe-order");
    expect((await u.client.rpc("order_drink", { p_drink: "latte" })).error?.code).toBe("P0001"); // house 0
    await houseAt(u.id, 2);
    expect((await u.client.rpc("order_drink", { p_drink: "beer" })).error?.code).toBe("22023");
    let last: { stamps: number; reward: unknown; ask: boolean } | null = null;
    for (let i = 0; i < CARD_SIZE; i++) {
      const r = await u.client.rpc("order_drink", { p_drink: DRINKS[i % DRINKS.length] });
      expect(r.error).toBeNull();
      last = r.data;
    }
    expect(last).toMatchObject({ stamps: CARD_SIZE, reward: CARD_REWARD.first });
    const decor = await admin()
      .from("decor")
      .select("item_id")
      .eq("user_id", u.id)
      .eq("item_id", "cafe_table");
    expect(decor.data).toHaveLength(1);
    const before = (await state(u.id)).coins;
    for (let i = 0; i < CARD_SIZE; i++) await u.client.rpc("order_drink", { p_drink: "water" });
    expect((await state(u.id)).coins).toBe(before + CARD_REWARD.later.coins);
    // Clients can't write orders or stamps themselves.
    expect(
      (await u.client.from("cafe_orders").insert({ user_id: u.id, drink: "latte", day: "2026-01-01" })).error,
    ).not.toBeNull();
    expect((await anon().rpc("order_drink", { p_drink: "latte" })).error).not.toBeNull();
  });

  it("the real-life question: asked once a day; 'later' allows one bedtime answer; 'game only' never asks", async () => {
    const u = await newUser("cafe-ask");
    await houseAt(u.id, 2);
    expect((await u.client.rpc("cafe_status")).data).toEqual({
      stamps: 0,
      answer: null,
      night: false,
      game_only: false,
    });
    expect((await u.client.rpc("order_drink", { p_drink: "latte" })).data).toMatchObject({ ask: true });
    expect((await u.client.rpc("answer_coffee", { p_answer: "later" })).error).toBeNull();
    // Answered today: the next order doesn't ask, and a second answer is refused.
    expect((await u.client.rpc("order_drink", { p_drink: "latte" })).data).toMatchObject({ ask: false });
    expect((await u.client.rpc("answer_coffee", { p_answer: "yes" })).error?.code).toBe("P0001");
    // Bedtime: once, after 'later' only.
    expect((await u.client.rpc("answer_coffee_night", { p_slot: "afternoon" })).error).toBeNull();
    expect((await u.client.rpc("answer_coffee_night", { p_slot: "evening" })).error?.code).toBe("P0001");
    expect((await u.client.rpc("cafe_status")).data).toEqual({
      stamps: 2,
      answer: "later",
      night: true,
      game_only: false,
    });
    const row = await admin().from("coffee_answers").select("answer, slot").eq("user_id", u.id).single();
    expect(row.data).toEqual({ answer: "later", slot: "afternoon" });
    // 'yes' records the order's time of day; 'play' records nothing for the insight.
    const v = await newUser("cafe-yes");
    await houseAt(v.id, 2);
    await v.client.rpc("order_drink", { p_drink: "americano" });
    expect((await v.client.rpc("answer_coffee", { p_answer: "yes" })).error).toBeNull();
    const vr = (await admin().from("coffee_answers").select("answer, slot").eq("user_id", v.id).single())
      .data;
    expect(vr?.answer).toBe("yes");
    expect(["morning", "afternoon", "evening"]).toContain(vr?.slot);
    expect((await v.client.rpc("answer_coffee_night", { p_slot: "none" })).error?.code).toBe("P0001");
    // Game only: never asks.
    const w = await newUser("cafe-off");
    await houseAt(w.id, 2);
    await w.client.from("profiles").update({ cafe_game_only: true }).eq("user_id", w.id);
    expect((await w.client.rpc("order_drink", { p_drink: "cocoa" })).data).toMatchObject({ ask: false });
    expect((await w.client.rpc("cafe_status")).data).toMatchObject({ stamps: 1, game_only: true });
    expect((await anon().rpc("cafe_status")).error).not.toBeNull();
    // Own rows only.
    expect((await w.client.from("coffee_answers").select("*")).data).toEqual([]);
    expect((await w.client.from("cafe_orders").select("drink")).data).toEqual([{ drink: "cocoa" }]);
  });
});
