import { describe, expect, it } from "vitest";
import { CAFFEINATED, CARD_REWARD, CARD_SIZE, DRINKS } from "@/content/cafe";
import { admin, anon, newUser } from "./helpers";

/** Som's café (docs/STORY.md): orders, stamps, card rewards, and the real-life answers (server). */
const houseAt = (id: string, level: number) =>
  admin().from("upgrades").upsert({ user_id: id, track: "house", level }, { onConflict: "user_id,track" });
const state = async (id: string) =>
  (await admin().from("game_state").select("coins, tickets").eq("user_id", id).single()).data as {
    coins: number;
    tickets: number;
  };
const answers = async (id: string) =>
  (await admin().from("coffee_answers").select("answer, drink, slot").eq("user_id", id)).data;

describe("Som's café (server)", () => {
  it("SQL knows the same drinks, caffeinated drinks and card size", async () => {
    for (const d of DRINKS) {
      expect((await admin().rpc("_cafe_drink_ok", { p_drink: d })).data).toBe(true);
      expect((await admin().rpc("_cafe_caffeine", { p_drink: d })).data).toBe(CAFFEINATED.includes(d));
    }
    expect((await admin().rpc("_cafe_drink_ok", { p_drink: "beer" })).data).toBe(false);
    expect((await admin().rpc("_cafe_card_size")).data).toBe(CARD_SIZE);
  });

  it("opens with the Farmhouse at level 2; a stamp per order; the first full card gives the café table, later ones never mint currency", async () => {
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
    // G7 R-C1: 20 more free taps = two more cards, a celebration only: no coins, no tickets.
    const before = await state(u.id);
    for (let i = 0; i < CARD_SIZE * 2; i++)
      last = (await u.client.rpc("order_drink", { p_drink: "water" })).data;
    expect(last).toMatchObject({ stamps: CARD_SIZE * 3, reward: { card: 3 } });
    expect(await state(u.id)).toEqual(before);
    expect(
      (await admin().from("decor").select("id").eq("user_id", u.id).eq("item_id", "cafe_table")).data,
    ).toHaveLength(1);
    // Clients can't write orders or stamps themselves.
    expect(
      (await u.client.from("cafe_orders").insert({ user_id: u.id, drink: "latte", day: "2026-01-01" })).error,
    ).not.toBeNull();
    expect((await anon().rpc("order_drink", { p_drink: "latte" })).error).not.toBeNull();
  });

  it("the real-life question: only after coffee/tea, once a day; 'later' allows one bedtime answer; 'game only' never asks", async () => {
    const u = await newUser("cafe-ask");
    await houseAt(u.id, 2);
    expect((await u.client.rpc("cafe_status")).data).toEqual({
      stamps: 0,
      answer: null,
      night: false,
      game_only: false,
      ordered: false,
    });
    // G7 R-C4: water never asks, and there's nothing to answer yet.
    expect((await u.client.rpc("order_drink", { p_drink: "water" })).data).toMatchObject({ ask: false });
    expect((await u.client.rpc("answer_coffee", { p_answer: "yes" })).error?.code).toBe("P0001");
    expect((await u.client.rpc("order_drink", { p_drink: "latte" })).data).toMatchObject({ ask: true });
    expect((await u.client.rpc("answer_coffee", { p_answer: "later" })).error).toBeNull();
    // Answered today: the next order doesn't ask, and a second answer is refused.
    expect((await u.client.rpc("order_drink", { p_drink: "latte" })).data).toMatchObject({ ask: false });
    expect((await u.client.rpc("answer_coffee", { p_answer: "yes" })).error?.code).toBe("P0001");
    expect((await u.client.rpc("add_real_cup")).error?.code).toBe("P0001"); // only after a yes
    // Bedtime: once, after 'later'.
    expect((await u.client.rpc("answer_coffee_night", { p_slot: "afternoon" })).error).toBeNull();
    expect((await u.client.rpc("answer_coffee_night", { p_slot: "evening" })).error?.code).toBe("P0001");
    expect(await answers(u.id)).toEqual([{ answer: "later", drink: "latte", slot: "afternoon" }]);
    expect((await u.client.rpc("cafe_status")).data).toEqual({
      stamps: 3,
      answer: "later",
      night: true,
      game_only: false,
      ordered: true,
    });

    // 'yes' records the time of day; another real cup keeps the latest; no bedtime question.
    const v = await newUser("cafe-yes");
    await houseAt(v.id, 2);
    await v.client.rpc("order_drink", { p_drink: "americano" });
    expect((await v.client.rpc("answer_coffee", { p_answer: "yes" })).error).toBeNull();
    const vr = (await answers(v.id))![0]!;
    expect(vr).toMatchObject({ answer: "yes", drink: "americano" });
    expect(["morning", "afternoon", "evening"]).toContain(vr.slot);
    // G7 R-C5: a morning "yes" plus an evening cup → the day is an evening-coffee day.
    await admin().from("coffee_answers").update({ slot: "morning" }).eq("user_id", v.id);
    const added = await v.client.rpc("add_real_cup");
    expect(added.error).toBeNull();
    expect((await answers(v.id))![0]!.slot).toBe(added.data);
    expect((await v.client.rpc("answer_coffee_night", { p_slot: "none" })).error?.code).toBe("P0001");

    // 'just playing' records no slot and refuses the bedtime answer (R-C16).
    const p = await newUser("cafe-play");
    await houseAt(p.id, 2);
    await p.client.rpc("order_drink", { p_drink: "matcha" });
    expect((await p.client.rpc("answer_coffee", { p_answer: "play" })).error).toBeNull();
    expect((await p.client.rpc("answer_coffee_night", { p_slot: "evening" })).error?.code).toBe("P0001");
    expect(await answers(p.id)).toEqual([{ answer: "play", drink: "matcha", slot: null }]);

    // Game only: never asks, and no bedtime answer.
    const w = await newUser("cafe-off");
    await houseAt(w.id, 2);
    await w.client.from("profiles").update({ cafe_game_only: true }).eq("user_id", w.id);
    expect((await w.client.rpc("order_drink", { p_drink: "latte" })).data).toMatchObject({ ask: false });
    expect((await w.client.rpc("cafe_status")).data).toMatchObject({ stamps: 1, game_only: true });
    expect((await w.client.rpc("answer_coffee_night", { p_slot: "none" })).error?.code).toBe("P0001");
    expect((await anon().rpc("cafe_status")).error).not.toBeNull();
    // Own rows only.
    expect((await w.client.from("coffee_answers").select("*")).data).toEqual([]);
    expect((await w.client.from("cafe_orders").select("drink")).data).toEqual([{ drink: "latte" }]);
  });

  it("G7 R-C6: a question left unanswered (tab switch, app closed) is asked once at bedtime", async () => {
    const u = await newUser("cafe-left");
    await houseAt(u.id, 2);
    expect((await u.client.rpc("order_drink", { p_drink: "thai_tea" })).data).toMatchObject({ ask: true });
    // No answer at all; bedtime answers once and becomes a 'later' day.
    expect((await u.client.rpc("answer_coffee_night", { p_slot: "evening" })).error).toBeNull();
    expect((await u.client.rpc("answer_coffee_night", { p_slot: "none" })).error?.code).toBe("P0001");
    expect(await answers(u.id)).toEqual([{ answer: "later", drink: null, slot: "evening" }]);
    // Without a coffee/tea order today there's nothing to answer at bedtime.
    const v = await newUser("cafe-left-water");
    await houseAt(v.id, 2);
    await v.client.rpc("order_drink", { p_drink: "cocoa" });
    expect((await v.client.rpc("answer_coffee_night", { p_slot: "none" })).error?.code).toBe("P0001");
  });
});
