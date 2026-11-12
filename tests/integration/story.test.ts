import { describe, expect, it } from "vitest";
import { STORY, STORY_BEATS } from "@/content/story";
import { admin, anon, newUser } from "./helpers";

/** Story beats with Som (docs/STORY.md): the server records what was seen and grants gifts. */
const state = async (id: string) =>
  (await admin().from("game_state").select("tickets").eq("user_id", id).single()).data as { tickets: number };
const seedQty = async (id: string, crop: string) =>
  ((
    await admin()
      .from("inventory")
      .select("qty")
      .eq("user_id", id)
      .eq("item_id", `seed:${crop}`)
      .maybeSingle()
  ).data?.qty as number | undefined) ?? 0;
/** Moves a seen beat to an earlier day, so the one-a-day rule lets the next one through. */
const ageSeen = (id: string) => admin().from("story_seen").update({ day: "2000-01-01" }).eq("user_id", id);

describe("story beats (server)", () => {
  it("gifts: SQL mirrors content/story.ts", async () => {
    for (const b of STORY_BEATS) {
      const r = await admin().rpc("_story_gift", { p_beat: b });
      expect(r.error).toBeNull();
      expect(r.data).toEqual(STORY[b].gift);
    }
  });

  it("chapter 0 plays once; a second claim and a second beat the same day are refused", async () => {
    const u = await newUser("story-0");
    const s0 = (await u.client.rpc("story_status")).data;
    expect(s0).toMatchObject({ seen: [], today: false, facts: { harvests: 0, good_days: 0 } });
    const r = await u.client.rpc("claim_story_beat", { p_beat: "ch0_gate" });
    expect(r.error).toBeNull();
    expect(r.data).toMatchObject({ beat: "ch0_gate", gift: null });
    expect((await u.client.rpc("claim_story_beat", { p_beat: "ch0_gate" })).error?.code).toBe("P0001");
    expect((await u.client.rpc("story_status")).data).toMatchObject({ seen: ["ch0_gate"], today: true });
    const ev = await admin()
      .from("events")
      .select("type, payload")
      .eq("user_id", u.id)
      .eq("type", "story_seen");
    expect(ev.data).toHaveLength(1);
  });

  it("a beat waits for its condition in the data; the gift is granted once", async () => {
    const u = await newUser("story-1");
    await u.client.rpc("claim_story_beat", { p_beat: "ch0_gate" });
    await ageSeen(u.id);
    // No harvest yet → refused.
    expect((await u.client.rpc("claim_story_beat", { p_beat: "ch1_first_harvest" })).error?.code).toBe(
      "P0001",
    );
    await admin()
      .from("events")
      .insert({ user_id: u.id, type: "harvest", payload: { crop: "radish" } });
    const before = await seedQty(u.id, "radish");
    const r = await u.client.rpc("claim_story_beat", { p_beat: "ch1_first_harvest" });
    expect(r.error).toBeNull();
    expect(await seedQty(u.id, "radish")).toBe(before + 1);
    // Chapter 2 needs 3 counted days.
    await ageSeen(u.id);
    expect((await u.client.rpc("claim_story_beat", { p_beat: "ch2_watering_can" })).error?.code).toBe(
      "P0001",
    );
    await admin()
      .from("day_results")
      .insert(
        ["2026-01-01", "2026-01-02", "2026-01-03"].map((date, i) => ({
          user_id: u.id,
          date,
          kind: i === 0 ? "perfect" : "minimum",
        })),
      );
    const t0 = (await state(u.id)).tickets;
    expect((await u.client.rpc("claim_story_beat", { p_beat: "ch2_watering_can" })).error).toBeNull();
    expect((await state(u.id)).tickets).toBe(t0 + 1);
  });

  it("parallel claims pay once; unknown beats, other users and anon are refused", async () => {
    const u = await newUser("story-race");
    await admin().from("events").insert({ user_id: u.id, type: "harvest", payload: {} });
    await u.client.rpc("claim_story_beat", { p_beat: "ch0_gate" });
    await ageSeen(u.id);
    const before = await seedQty(u.id, "radish");
    const tries = await Promise.all(
      [1, 2, 3, 4].map(() => u.client.rpc("claim_story_beat", { p_beat: "ch1_first_harvest" })),
    );
    expect(tries.filter((t) => !t.error)).toHaveLength(1);
    expect(await seedQty(u.id, "radish")).toBe(before + 1);
    expect((await u.client.rpc("claim_story_beat", { p_beat: "ch9_moon" })).error?.code).toBe("22023");
    expect((await anon().rpc("claim_story_beat", { p_beat: "ch0_gate" })).error).not.toBeNull();
    // Clients can't write the ledger directly or read someone else's.
    const other = await newUser("story-other");
    expect((await other.client.from("story_seen").select("*")).data).toEqual([]);
    expect(
      (
        await other.client
          .from("story_seen")
          .insert({ user_id: other.id, beat: "ch2_watering_can", day: "2026-01-01" })
      ).error,
    ).not.toBeNull();
  });
});

describe("G7 STORY-R5: story events are server-written only", () => {
  it("a client can't insert a story_seen event", async () => {
    const u = await newUser("story-ev");
    const r = await u.client
      .from("events")
      .insert({ user_id: u.id, type: "story_seen", payload: { beat: "ch2_watering_can" } });
    expect(r.error).not.toBeNull();
  });
});
