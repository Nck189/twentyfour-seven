import { describe, expect, it } from "vitest";
import { addDays, zonedInstant } from "@/lib/time";
import { admin, newUser } from "./helpers";

/**
 * Playtest R1 R2 (Minnie OK 2026-11-11): a finished day with nothing logged at all is "away" and
 * the farm pauses (`_away_day` in `_plot_ripe`), like lib/game `buildDayFacts` → `away`.
 */
const TZ = "Asia/Bangkok";

async function setup(tag: string) {
  const u = await newUser(tag);
  const today: string = (await u.client.rpc("settle_days")).data.today;
  const y = addDays(today, -1);
  await admin()
    .from("profiles")
    .update({ created_at: zonedInstant(addDays(today, -10), 6 * 60, TZ).toISOString() })
    .eq("user_id", u.id);
  // Radish (1 day) in Wake, planted 7 days before yesterday: 6 untouched days, then yesterday.
  await admin()
    .from("plots")
    .update({ crop_id: "radish", planted_on: addDays(y, -7), state: "growing" })
    .eq("user_id", u.id)
    .eq("slot", "wake");
  const wakeOn = (d: string) =>
    admin()
      .from("wake_events")
      .insert({
        user_id: u.id,
        date: d,
        target_wake: zonedInstant(d, 7 * 60, TZ).toISOString(),
        pressed_at: zonedInstant(d, 7 * 60 + 2, TZ).toISOString(),
        in_window: true,
        backfilled: false,
      });
  return { u, y, wakeOn };
}

describe("away days pause the farm (server)", () => {
  it("six days away, then an in-window I'm up: the radish survived and is ripe", async () => {
    const { u, y, wakeOn } = await setup("away-yes");
    await wakeOn(y);
    expect((await u.client.rpc("harvest_plot", { p_slot: "wake" })).error).toBeNull();
  });

  it("the same days with a log each (the app was used, Wake skipped) are misses: it died", async () => {
    const { u, y, wakeOn } = await setup("away-no");
    for (let i = 6; i >= 1; i--) {
      const d = addDays(y, -i);
      await admin()
        .from("block_logs")
        .insert({
          user_id: u.id,
          date: d,
          block: "focus",
          planned_start: zonedInstant(d, 9 * 60, TZ).toISOString(),
        });
    }
    await wakeOn(y);
    expect((await u.client.rpc("harvest_plot", { p_slot: "wake" })).error?.code).toBe("22023");
  });

  it("G7 F5: a user can't delete their own logs to fake away days (the welcome-back gift, erased misses)", async () => {
    const { u, y } = await setup("away-tamper");
    const d = addDays(y, -1);
    await admin()
      .from("block_logs")
      .insert({
        user_id: u.id,
        date: d,
        block: "focus",
        planned_start: zonedInstant(d, 9 * 60, TZ).toISOString(),
      });
    await u.client.from("block_logs").delete().eq("user_id", u.id);
    const left = await admin().from("block_logs").select("id").eq("user_id", u.id);
    expect(left.data).toHaveLength(1);
  });
});
