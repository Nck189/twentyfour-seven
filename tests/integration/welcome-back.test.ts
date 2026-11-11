import { describe, expect, it } from "vitest";
import { addDays, zonedInstant } from "@/lib/time";
import { admin, newUser } from "./helpers";

/**
 * Playtest R1 R3 (Minnie OK 2026-11-11): coming back after ≥ 2 away days is welcomed with a gift
 * (+1 ticket, once), and 3 minimum days within 5 days of it pay +2 more ("back on track").
 * Both are server-side: the client only asks.
 */
const TZ = "Asia/Bangkok";

async function setup(tag: string) {
  const u = await newUser(tag);
  const today: string = (await u.client.rpc("settle_days")).data.today;
  await admin()
    .from("profiles")
    .update({ created_at: zonedInstant(addDays(today, -20), 6 * 60, TZ).toISOString() })
    .eq("user_id", u.id);
  const logOn = (d: string) =>
    admin()
      .from("block_logs")
      .insert({
        user_id: u.id,
        date: d,
        block: "focus",
        planned_start: zonedInstant(d, 9 * 60, TZ).toISOString(),
      });
  const minimumDay = async (d: string) => {
    await admin()
      .from("wake_events")
      .insert({
        user_id: u.id,
        date: d,
        target_wake: zonedInstant(d, 7 * 60, TZ).toISOString(),
        pressed_at: zonedInstant(d, 7 * 60 + 2, TZ).toISOString(),
        in_window: true,
        backfilled: false,
      });
    await admin().from("ticket_grants").insert({ user_id: u.id, reason: "night", ref_date: d, amount: 1 });
  };
  const tickets = async () =>
    (
      (await admin().from("game_state").select("tickets").eq("user_id", u.id).single()).data as {
        tickets: number;
      }
    ).tickets;
  return { u, today, logOn, minimumDay, tickets };
}

describe("welcome back (server)", () => {
  it("active 5 days ago, then 4 days away: welcomed once with +1 ticket", async () => {
    const { u, today, logOn, tickets } = await setup("wb-yes");
    await logOn(addDays(today, -5));
    const s = (await u.client.rpc("welcome_back_status")).data;
    expect(s).toMatchObject({ lapsed: true, away_days: 4 });
    const before = await tickets();
    expect((await u.client.rpc("claim_welcome_back")).data).toMatchObject({ granted: true });
    expect(await tickets()).toBe(before + 1);
    expect((await u.client.rpc("claim_welcome_back")).data).toMatchObject({ granted: false });
    expect(await tickets()).toBe(before + 1);
    expect((await u.client.rpc("welcome_back_status")).data).toMatchObject({ lapsed: false });
  });

  it("not a lapse: active yesterday, or never active before", async () => {
    const a = await setup("wb-yday");
    await a.logOn(addDays(a.today, -5));
    await a.logOn(addDays(a.today, -1));
    expect((await a.u.client.rpc("welcome_back_status")).data).toMatchObject({ lapsed: false });
    expect((await a.u.client.rpc("claim_welcome_back")).data).toMatchObject({ granted: false });
    const b = await setup("wb-new");
    expect((await b.u.client.rpc("welcome_back_status")).data).toMatchObject({ lapsed: false });
  });

  it("back on track: 3 minimum days within 5 days of the welcome pay +2 once", async () => {
    const { u, today, minimumDay, tickets } = await setup("wb-goal");
    const w = addDays(today, -3);
    await admin()
      .from("ticket_grants")
      .insert({ user_id: u.id, reason: "welcome_back", ref_date: w, amount: 1 });
    await minimumDay(w);
    await minimumDay(addDays(w, 1));
    expect((await u.client.rpc("welcome_back_status")).data).toMatchObject({ goal: { done: 2, need: 3 } });
    expect((await u.client.rpc("claim_back_on_track")).data).toMatchObject({ granted: false });
    await minimumDay(addDays(w, 2));
    expect((await u.client.rpc("welcome_back_status")).data).toMatchObject({
      goal: { done: 3, need: 3, claimed: false },
    });
    const before = await tickets();
    expect((await u.client.rpc("claim_back_on_track")).data).toMatchObject({ granted: true });
    expect((await u.client.rpc("claim_back_on_track")).data).toMatchObject({ granted: false });
    expect(await tickets()).toBe(before + 2);
  });
});
