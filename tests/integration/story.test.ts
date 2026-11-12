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

describe("chapters 3–6 and the café opening (docs/STORY.md)", () => {
  it("each waits for its data; the sign is placed on the farm, the album pays 2 tickets", async () => {
    const u = await newUser("story-ch3");
    const s = (await u.client.rpc("story_status")).data as { facts: Record<string, number> };
    expect(s.facts).toMatchObject({ hatched: 0, best_streak: 0, days_used: 0, house: 0 });
    for (const b of ["ch3_new_friend", "ch4_sunset", "ch5_house", "ch6_album", "cafe_open"])
      expect((await u.client.rpc("claim_story_beat", { p_beat: b })).error?.code).toBe("P0001");

    await admin().from("animals").insert({ user_id: u.id, species: "chicken" });
    expect((await u.client.rpc("claim_story_beat", { p_beat: "ch3_new_friend" })).error).toBeNull();

    await ageSeen(u.id);
    await admin().from("game_state").update({ best_streak: 7 }).eq("user_id", u.id);
    expect((await u.client.rpc("claim_story_beat", { p_beat: "ch4_sunset" })).error).toBeNull();
    const sign = await admin().from("decor").select("item_id").eq("user_id", u.id).eq("item_id", "farm_sign");
    expect(sign.data).toHaveLength(1);

    await ageSeen(u.id);
    await admin()
      .from("upgrades")
      .upsert({ user_id: u.id, track: "house", level: 1 }, { onConflict: "user_id,track" });
    expect((await u.client.rpc("claim_story_beat", { p_beat: "cafe_open" })).error?.code).toBe("P0001");
    expect((await u.client.rpc("claim_story_beat", { p_beat: "ch5_house" })).error).toBeNull();
    await ageSeen(u.id);
    await admin()
      .from("upgrades")
      .upsert({ user_id: u.id, track: "house", level: 2 }, { onConflict: "user_id,track" });
    expect((await u.client.rpc("claim_story_beat", { p_beat: "cafe_open" })).error).toBeNull();

    // 30 days used, not in a row (every other day), since the account was made.
    await ageSeen(u.id);
    await admin()
      .from("profiles")
      .update({ created_at: new Date(Date.UTC(2025, 11, 20)).toISOString() })
      .eq("user_id", u.id);
    const wake = (i: number, backfilled: boolean) => {
      const date = new Date(Date.UTC(2026, 0, 1 + i * 2)).toISOString().slice(0, 10);
      return {
        user_id: u.id,
        date,
        target_wake: `${date}T00:00:00Z`,
        pressed_at: `${date}T00:05:00Z`,
        in_window: true,
        backfilled,
      };
    };
    // G7 R2-1 (S1): filled-in days don't count (backfill reaches 30 days back, even before sign-up).
    await admin()
      .from("wake_events")
      .insert(Array.from({ length: 30 }, (_, i) => wake(i, i % 3 === 0)));
    expect((await u.client.rpc("claim_story_beat", { p_beat: "ch6_album" })).error?.code).toBe("P0001");
    await admin().from("wake_events").update({ backfilled: false }).eq("user_id", u.id);
    const t0 = (await state(u.id)).tickets;
    expect((await u.client.rpc("claim_story_beat", { p_beat: "ch6_album" })).error).toBeNull();
    expect((await state(u.id)).tickets).toBe(t0 + 2);
  });
});

describe("G7 R2-1: days used never count filled-in days or days before the account", () => {
  it("a new account backfilling 30 days can't claim the 30-day album", async () => {
    const u = await newUser("story-backfill");
    const today = new Date();
    const rows = Array.from({ length: 30 }, (_, i) => {
      const date = new Date(today.getTime() - (i + 1) * 86_400_000).toISOString().slice(0, 10);
      return {
        user_id: u.id,
        date,
        target_wake: `${date}T00:00:00Z`,
        pressed_at: `${date}T00:05:00Z`,
        in_window: true,
        backfilled: true,
      };
    });
    await admin().from("wake_events").insert(rows);
    // Even if they were live presses: all before the account existed.
    await admin()
      .from("wake_events")
      .insert(rows.map((r) => ({ ...r, date: r.date.replace(/^2026/, "2025"), backfilled: false })));
    const t0 = (await state(u.id)).tickets;
    expect((await u.client.rpc("claim_story_beat", { p_beat: "ch6_album" })).error?.code).toBe("P0001");
    expect((await state(u.id)).tickets).toBe(t0);
    expect(
      ((await u.client.rpc("story_status")).data as { facts: { days_used: number } }).facts.days_used,
    ).toBe(0);
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
