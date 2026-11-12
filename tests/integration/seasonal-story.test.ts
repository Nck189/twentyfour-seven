import { describe, expect, it } from "vitest";
import { admin, anon, newUser } from "./helpers";

/**
 * Candle Lotus story beats (docs/STORY.md "Seasonal crops"): once per crop per year, the server
 * checks each trigger from data and the calendar date (`season_clock` in tests), and the "use"
 * beat's optional private wish.
 */
const qty = async (id: string, item: string) =>
  ((await admin().from("inventory").select("qty").eq("user_id", id).eq("item_id", item).maybeSingle()).data
    ?.qty as number | undefined) ?? 0;
const give = (id: string, item_id: string, n: number) =>
  admin().from("inventory").upsert({ user_id: id, item_id, qty: n }, { onConflict: "user_id,item_id" });
const clock = (id: string, today: string) =>
  admin().from("season_clock").upsert({ user_id: id, today }, { onConflict: "user_id" });
/** The main chapters were seen on an earlier day, so a seasonal beat is next. */
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

describe("Candle Lotus beats and the wish (server)", () => {
  it("opening (day 1+) gives a seed once a year; market waits for day 15; use waits for a sale", async () => {
    const u = await newUser("ss-beats");
    await mainSeen(u.id);
    await clock(u.id, "2026-10-30");
    expect((await u.client.rpc("claim_story_beat", { p_beat: "lotus_open" })).error?.code).toBe("P0001");
    await clock(u.id, "2026-11-03");
    const r = await u.client.rpc("claim_story_beat", { p_beat: "lotus_open" });
    expect(r.error).toBeNull();
    expect(r.data).toMatchObject({
      beat: "lotus_open",
      key: "lotus_open:2026",
      gift: { seed: { crop: "candle_lotus", n: 1 } },
    });
    expect(await qty(u.id, "seed:candle_lotus")).toBe(1);
    await ageSeen(u.id);
    expect((await u.client.rpc("claim_story_beat", { p_beat: "lotus_open" })).error?.code).toBe("P0001");
    expect(await qty(u.id, "seed:candle_lotus")).toBe(1);
    // Market: not before day 15.
    expect((await u.client.rpc("claim_story_beat", { p_beat: "lotus_market" })).error?.code).toBe("P0001");
    await clock(u.id, "2026-11-16");
    expect((await u.client.rpc("claim_story_beat", { p_beat: "lotus_market" })).error).toBeNull();
    // One beat a day still holds.
    expect((await u.client.rpc("claim_story_beat", { p_beat: "lotus_use" })).error?.code).toBe("P0001");
    await ageSeen(u.id);
    // Use: needs a sale or delivery this season-year.
    expect((await u.client.rpc("claim_story_beat", { p_beat: "lotus_use" })).error?.code).toBe("P0001");
    await give(u.id, "crop:candle_lotus:normal:100", 1);
    expect(
      (await u.client.rpc("sell_produce", { p_item: "crop:candle_lotus:normal:100", p_qty: 1 })).error,
    ).toBeNull();
    const st = (await u.client.rpc("story_status")).data;
    expect(st.facts).toMatchObject({ day: "2026-11-16", season_uses: ["candle_lotus:2026"] });
    expect((await u.client.rpc("claim_story_beat", { p_beat: "lotus_use" })).error).toBeNull();
    const seen = (await admin().from("story_seen").select("beat").eq("user_id", u.id)).data!.map(
      (x) => x.beat,
    );
    expect(seen).toEqual(expect.arrayContaining(["lotus_open:2026", "lotus_market:2026", "lotus_use:2026"]));
    // Next year the opening is new again (and gifts again).
    await ageSeen(u.id);
    await clock(u.id, "2027-11-01");
    expect((await u.client.rpc("claim_story_beat", { p_beat: "lotus_open" })).data).toMatchObject({
      key: "lotus_open:2027",
    });
    expect(await qty(u.id, "seed:candle_lotus")).toBe(2);
  });

  it("float a wish: optional, only after this year's use beat, ≤ 120 chars, once, private", async () => {
    const u = await newUser("ss-wish");
    await clock(u.id, "2026-11-20");
    expect((await u.client.rpc("float_wish", { p_wish: "too early" })).error?.code).toBe("P0001");
    await admin().from("story_seen").insert({ user_id: u.id, beat: "lotus_use:2026", day: "2000-01-01" });
    expect((await u.client.rpc("float_wish", { p_wish: "   " })).error?.code).toBe("22023");
    expect((await u.client.rpc("float_wish", { p_wish: "x".repeat(121) })).error?.code).toBe("22023");
    const r = await u.client.rpc("float_wish", { p_wish: "  pass my exams and sleep before midnight  " });
    expect(r.error).toBeNull();
    expect(r.data).toEqual({ year: 2026 });
    expect((await u.client.rpc("float_wish", { p_wish: "another" })).error?.code).toBe("P0001");
    const mine = (await u.client.from("wishes").select("year, wish, returned_at")).data;
    expect(mine).toEqual([
      { year: 2026, wish: "pass my exams and sleep before midnight", returned_at: null },
    ]);
    // The analytics event never carries the wish itself.
    const ev = (await admin().from("events").select("payload").eq("user_id", u.id).eq("type", "wish_floated"))
      .data;
    expect(ev).toEqual([{ payload: { year: 2026 } }]);
    // Private: nobody else sees it; the owner can't rewrite it directly, but can delete it.
    const other = await newUser("ss-wish-other");
    expect((await other.client.from("wishes").select("*")).data).toEqual([]);
    await u.client.from("wishes").update({ wish: "edited" }).eq("year", 2026);
    await u.client.from("wishes").insert({ user_id: u.id, year: 2027, wish: "direct" });
    expect((await admin().from("wishes").select("wish").eq("user_id", u.id)).data).toEqual([
      { wish: "pass my exams and sleep before midnight" },
    ]);
    expect((await u.client.from("wishes").delete().eq("year", 2026)).error).toBeNull();
    expect((await admin().from("wishes").select("*").eq("user_id", u.id)).data).toEqual([]);
    expect((await anon().rpc("float_wish", { p_wish: "hi" })).error).not.toBeNull();
  });
});
