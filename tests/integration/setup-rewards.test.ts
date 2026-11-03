import { describe, expect, it } from "vitest";
import { SETUP_REWARD } from "@/content/unlocks";
import { admin, newUser } from "./helpers";

/** M7 setup rewards (SPEC §8.8c): paid once, from real data, never by the client. */
describe("claim_setup_rewards / report_home_screen", () => {
  it("pays each done step once and nothing for steps not done", async () => {
    const u = await newUser("setup");
    const fresh = await u.client.rpc("claim_setup_rewards");
    expect(fresh.error).toBeNull();
    expect(fresh.data).toEqual({ done: [], granted: [] });

    const { data: s } = await u.client.from("settings").select("blocks").eq("user_id", u.id).single();
    const blocks = (s!.blocks as { first10: string | null; checklist: unknown[] }[]).map((b, i) =>
      i === 0 ? { ...b, first10: "Stretch", checklist: [{ id: "a", label: "Water" }] } : b,
    );
    await u.client.from("settings").update({ blocks }).eq("user_id", u.id);
    await u.client.from("backlog_items").insert({ user_id: u.id, title: "Read", estimate_min: 30 });
    await u.client
      .from("profiles")
      .update({ onboarding: { done: true } })
      .eq("user_id", u.id);

    const a = await u.client.rpc("claim_setup_rewards");
    expect(a.error).toBeNull();
    expect([...a.data.granted].sort()).toEqual(["backlog_estimate", "checklist", "first10", "sleep_times"]);
    const b = await u.client.rpc("claim_setup_rewards");
    expect(b.data.granted).toEqual([]);

    const gs = (await admin().from("game_state").select("tickets, coins").eq("user_id", u.id).single()).data!;
    expect(gs.tickets).toBe(1);
    expect(gs.coins).toBe(35);
    const seed = (
      await admin()
        .from("inventory")
        .select("qty")
        .eq("user_id", u.id)
        .eq("item_id", "seed:strawberry")
        .single()
    ).data!;
    expect(seed.qty).toBe((SETUP_REWARD.sleep_times as { seed: { n: number } }).seed.n);

    // Undoing a setting doesn't take the reward back; redoing it doesn't pay again.
    await u.client.from("settings").update({ blocks: s!.blocks }).eq("user_id", u.id);
    await u.client.from("settings").update({ blocks }).eq("user_id", u.id);
    expect((await u.client.rpc("claim_setup_rewards")).data.granted).toEqual([]);
    expect((await admin().from("game_state").select("coins").eq("user_id", u.id).single()).data!.coins).toBe(
      35,
    );
  });

  it("the Home Screen report pays its decor once", async () => {
    const u = await newUser("home");
    expect((await u.client.rpc("report_home_screen")).data).toEqual({ granted: true });
    expect((await u.client.rpc("report_home_screen")).data).toEqual({ granted: false });
    const { data } = await u.client.from("decor").select("item_id");
    expect(data).toEqual([{ item_id: "flowers" }]);
  });

  it("the client can't write the ledger, call the internals or fake the event", async () => {
    const u = await newUser("setupfake");
    const ins = await u.client
      .from("unlock_grants")
      .insert({ user_id: u.id, unlock_id: "first10", reward: {} });
    expect(ins.error).not.toBeNull();
    expect((await u.client.rpc("_grant_unlock", { uid: u.id, p_id: "first10" })).error).not.toBeNull();
    const ev = await u.client.from("events").insert({ user_id: u.id, type: "unlock_granted", payload: {} });
    expect(ev.error).not.toBeNull();
    const { data } = await u.client.from("game_state").select("tickets").eq("user_id", u.id).single();
    expect(data!.tickets).toBe(0);
  });
});
