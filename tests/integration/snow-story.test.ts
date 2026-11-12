import { describe, expect, it } from "vitest";
import { STORY } from "@/content/story";
import { admin, anon, newUser } from "./helpers";

/**
 * December's Snow Strawberry beats (docs/STORY.md "Seasonal crops"): opening (Dec 1+, a seed),
 * the winter-lights market (Dec 15+), and the use beat (first sale or delivery) with the
 * year-end cake and a year in review from the user's own data.
 */
const qty = async (id: string, item: string) =>
  ((await admin().from("inventory").select("qty").eq("user_id", id).eq("item_id", item).maybeSingle()).data
    ?.qty as number | undefined) ?? 0;
const clock = (id: string, today: string) =>
  admin().from("season_clock").upsert({ user_id: id, today }, { onConflict: "user_id" });
const mainSeen = (id: string) =>
  admin()
    .from("story_seen")
    .insert(
      ["ch0_gate", "ch1_first_harvest", "ch2_watering_can"].map((beat) => ({
        user_id: id,
        beat,
        day: "2000-01-01",
      })),
    );
const ageSeen = (id: string) => admin().from("story_seen").update({ day: "2000-01-01" }).eq("user_id", id);

describe("Snow Strawberry beats (server)", () => {
  it("gifts mirror content/story.ts", async () => {
    for (const b of ["snow_open", "snow_market", "snow_use"] as const) {
      const r = await admin().rpc("_story_gift", { p_beat: b });
      expect(r.error).toBeNull();
      expect(r.data).toEqual(STORY[b].gift);
    }
  });

  it("opening from Dec 1 gives a seed once a year; market waits for the 15th; use waits for a sale", async () => {
    const u = await newUser("snow-beats");
    await mainSeen(u.id);
    await clock(u.id, "2026-11-30");
    expect((await u.client.rpc("claim_story_beat", { p_beat: "snow_open" })).error?.code).toBe("P0001");
    await clock(u.id, "2026-12-02");
    const r = await u.client.rpc("claim_story_beat", { p_beat: "snow_open" });
    expect(r.error).toBeNull();
    expect(r.data).toMatchObject({ beat: "snow_open", key: "snow_open:2026" });
    expect(await qty(u.id, "seed:snow_strawberry")).toBe(1);
    await ageSeen(u.id);
    expect((await u.client.rpc("claim_story_beat", { p_beat: "snow_market" })).error?.code).toBe("P0001");
    await clock(u.id, "2026-12-16");
    expect((await u.client.rpc("claim_story_beat", { p_beat: "snow_market" })).error).toBeNull();
    await ageSeen(u.id);
    expect((await u.client.rpc("claim_story_beat", { p_beat: "snow_use" })).error?.code).toBe("P0001");
    // A sale on the test clock's date (the server reads the sale's own time; in the app it's "now").
    await admin()
      .from("events")
      .insert({
        user_id: u.id,
        type: "produce_sold",
        payload: { item: "crop:snow_strawberry:normal:100", qty: 1, coins: 24 },
        at: "2026-12-16T05:00:00Z",
      });
    expect((await u.client.rpc("claim_story_beat", { p_beat: "snow_use" })).error).toBeNull();
  });

  it("year in review counts this user's year only: harvests, best streak, mornings on time", async () => {
    const u = await newUser("snow-review");
    const other = await newUser("snow-review-other");
    await clock(u.id, "2026-12-20");
    await admin()
      .from("events")
      .insert([
        { user_id: u.id, type: "harvest", payload: {}, at: "2026-03-01T03:00:00Z" },
        { user_id: u.id, type: "harvest", payload: {}, at: "2026-11-01T03:00:00Z" },
        { user_id: u.id, type: "harvest", payload: {}, at: "2025-12-30T03:00:00Z" }, // last year
        { user_id: other.id, type: "harvest", payload: {}, at: "2026-05-01T03:00:00Z" },
      ]);
    await admin().from("game_state").update({ best_streak: 12 }).eq("user_id", u.id);
    const wake = (date: string, in_window: boolean, backfilled = false) => ({
      user_id: u.id,
      date,
      target_wake: `${date}T00:00:00Z`,
      pressed_at: `${date}T00:05:00Z`,
      in_window,
      backfilled,
    });
    await admin()
      .from("wake_events")
      .insert([
        wake("2026-02-01", true),
        wake("2026-02-02", true),
        wake("2026-02-03", false),
        wake("2026-02-04", true, true), // backfilled doesn't count
        wake("2025-12-31", true), // last year
      ]);
    const r = await u.client.rpc("year_review");
    expect(r.error).toBeNull();
    expect(r.data).toEqual({ year: 2026, harvests: 2, best_streak: 12, mornings: 2 });
    expect((await anon().rpc("year_review")).error).not.toBeNull();
    // G7 R-C2: the cake can wait into January (or a later first sale): still last season's year.
    await clock(u.id, "2027-01-05");
    expect((await u.client.rpc("year_review")).data).toMatchObject({ year: 2026, harvests: 2 });
  });
});
