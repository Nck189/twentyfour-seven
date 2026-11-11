import { describe, expect, it } from "vitest";
import { addDays, zonedInstant } from "@/lib/time";
import { admin, newUser } from "./helpers";

/**
 * Playtest R1 R1 (Minnie OK 2026-11-11): lived actions are credited on the server too
 * (`_credited` in `_plot_ripe` and `_day_oee`), like lib/game `credited`.
 */
const TZ = "Asia/Bangkok";

async function setup(tag: string) {
  const u = await newUser(tag);
  const today: string = (await u.client.rpc("settle_days")).data.today;
  const y = addDays(today, -1);
  // An account from before yesterday, with radish planted in Wake and Down the day before.
  await admin()
    .from("profiles")
    .update({ created_at: zonedInstant(addDays(today, -3), 6 * 60, TZ).toISOString() })
    .eq("user_id", u.id);
  for (const slot of ["wake", "down"]) {
    await admin()
      .from("plots")
      .update({ crop_id: "radish", planted_on: addDays(y, -1), state: "growing" })
      .eq("user_id", u.id)
      .eq("slot", slot);
  }
  return { u, today, y };
}

describe("lived actions grow their block's plot (server)", () => {
  it("an in-window I'm up ripens Wake; the Night ticket ripens Down — with no block check-ins", async () => {
    const { u, y } = await setup("credit-yes");
    await admin()
      .from("wake_events")
      .insert({
        user_id: u.id,
        date: y,
        target_wake: zonedInstant(y, 7 * 60, TZ).toISOString(),
        pressed_at: zonedInstant(y, 7 * 60 + 2, TZ).toISOString(),
        in_window: true,
        backfilled: false,
      });
    await admin().from("ticket_grants").insert({ user_id: u.id, reason: "night", ref_date: y, amount: 1 });
    expect((await u.client.rpc("harvest_plot", { p_slot: "wake" })).error).toBeNull();
    expect((await u.client.rpc("harvest_plot", { p_slot: "down" })).error).toBeNull();
  });

  it("without them the plots don't grow (nothing else changed)", async () => {
    const { u } = await setup("credit-no");
    expect((await u.client.rpc("harvest_plot", { p_slot: "wake" })).error?.code).toBe("22023");
    expect((await u.client.rpc("harvest_plot", { p_slot: "down" })).error?.code).toBe("22023");
  });

  it("Day score counts them as on-time starts", async () => {
    const { u, y } = await setup("credit-oee");
    await admin()
      .from("wake_events")
      .insert({
        user_id: u.id,
        date: y,
        target_wake: zonedInstant(y, 7 * 60, TZ).toISOString(),
        pressed_at: zonedInstant(y, 7 * 60 + 2, TZ).toISOString(),
        in_window: true,
        backfilled: false,
      });
    await admin().from("ticket_grants").insert({ user_id: u.id, reason: "night", ref_date: y, amount: 1 });
    // First-10s done in Wake and Down (no "Start" taps): quality 2/7, availability 2/7 only
    // thanks to the credits (it was 0 before), performance 1.
    for (const block of ["wake", "down"]) {
      await admin()
        .from("block_logs")
        .insert({ user_id: u.id, date: y, block, first10_at: zonedInstant(y, 8 * 60, TZ).toISOString() });
    }
    const { data, error } = await admin().rpc("_day_oee", { uid: u.id, d: y });
    expect(error).toBeNull();
    expect(data).toBeCloseTo((2 / 7) * (2 / 7), 5);
  });
});
