import { describe, expect, it } from "vitest";
import { DEFAULT_BLOCKS } from "@/content/blocks";
import { addDays, localDate, zonedInstant } from "@/lib/time";
import { admin, newUser } from "./helpers";

/** Rule B on the server: an untracked block is out of the Day score (`_day_oee`), like lib/game. */
const TZ = "Asia/Bangkok";
describe("tracked blocks (server Day score)", () => {
  it("leaves untracked blocks out; Wake, Down Time and Sleep always count", async () => {
    const u = await newUser("tracked-oee");
    const d = addDays(localDate(new Date(), TZ), -2);
    const at = (min: number) => zonedInstant(d, min, TZ).toISOString();
    const rows = (["wake", "down", "sleep", "work"] as const).map((block, i) => ({
      user_id: u.id,
      date: d,
      block,
      planned_start: at(8 * 60 + i * 60),
      started_at: at(8 * 60 + i * 60 + 3),
      first10_at: at(8 * 60 + i * 60 + 8),
    }));
    expect((await admin().from("block_logs").insert(rows)).error).toBeNull();
    const oee = async () => (await admin().rpc("_day_oee", { uid: u.id, d })).data as number;
    expect(await oee()).toBeCloseTo((4 / 7) * (4 / 7), 4);
    // Untrack the optional blocks the person doesn't do, and try to untrack a core one too.
    const blocks = DEFAULT_BLOCKS.map((b) =>
      ["focus", "gradation", "free", "sleep"].includes(b.key) ? { ...b, tracked: false } : b,
    );
    expect((await u.client.from("settings").update({ blocks }).eq("user_id", u.id)).error).toBeNull();
    expect(await oee()).toBeCloseTo(1, 4);
    // Sleep stays in: with no Sleep check-in, the score drops again.
    await admin().from("block_logs").delete().eq("user_id", u.id).eq("block", "sleep");
    expect(await oee()).toBeCloseTo((3 / 4) * (3 / 4), 4);
  });
  it("the server grows an untracked plot on kept days, like lib/game, and prices it as normal quality", async () => {
    const u = await newUser("tracked-grow");
    const today = localDate(new Date(), TZ);
    const d = (n: number) => addDays(today, -n);
    const blocks = DEFAULT_BLOCKS.map((b) => (b.key === "focus" ? { ...b, tracked: false } : b));
    expect((await u.client.from("settings").update({ blocks }).eq("user_id", u.id)).error).toBeNull();
    await admin()
      .from("plots")
      .update({ crop_id: "tomato", planted_on: d(4), state: "growing" })
      .eq("user_id", u.id)
      .eq("slot", "focus");
    // d3: kept (wake); d2: nothing (quiet); d1: kept (ritual only) → 2 growth days → a tomato is ripe.
    expect(
      (
        await admin()
          .from("wake_events")
          .insert({
            user_id: u.id,
            date: d(3),
            target_wake: zonedInstant(d(3), 7 * 60, TZ).toISOString(),
            pressed_at: zonedInstant(d(3), 7 * 60, TZ).toISOString(),
            in_window: true,
            backfilled: false,
          })
      ).error,
    ).toBeNull();
    expect(
      (
        await admin()
          .from("ticket_grants")
          .insert({ user_id: u.id, reason: "night", ref_date: d(1), amount: 1 })
      ).error,
    ).toBeNull();
    expect((await u.client.rpc("harvest_plot", { p_slot: "focus" })).error).toBeNull();
    const { data: inv } = await u.client.from("inventory").select("item_id");
    expect((inv ?? []).map((i) => (i.item_id as string).split(":").slice(0, 3).join(":"))).toEqual([
      "crop:tomato:normal",
    ]);
  });
});
