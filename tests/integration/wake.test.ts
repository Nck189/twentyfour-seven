import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { localParts } from "@/lib/time";
import { newUser } from "./helpers";

const TZ = "Asia/Bangkok";
/** Sets every template's target wake to (now − minutesAgo) in Bangkok local time. */
async function setTargetMinutesAgo(c: SupabaseClient, minutesAgo: number) {
  const t = new Date(Date.now() - minutesAgo * 60_000);
  const p = localParts(t, TZ);
  const hhmm = `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
  const { error } = await c.from("templates").update({ target_wake: hhmm, options: {} }).neq("key", "");
  expect(error).toBeNull();
}
const tickets = async (c: SupabaseClient) =>
  (await c.from("game_state").select("tickets").single()).data!.tickets;

describe("press_wake (CJ-03 / CJ-04)", () => {
  it("CJ-03 within the window: +1 Sunrise ticket, in_window true, once per day", async () => {
    const u = await newUser("wake-in");
    // Avoid flakiness right at local midnight (target would fall on the previous date).
    if (localParts(new Date(), TZ).hour === 0 && localParts(new Date(), TZ).minute < 30) return;
    await setTargetMinutesAgo(u.client, 10);
    const { data, error } = await u.client.rpc("press_wake");
    expect(error).toBeNull();
    expect(data).toMatchObject({ in_window: true, backfilled: false });
    expect(await tickets(u.client)).toBe(1);
    // Second press: same row, no extra ticket.
    const again = await u.client.rpc("press_wake");
    expect(again.data.id).toBe(data.id);
    expect(await tickets(u.client)).toBe(1);
    const { data: ev } = await u.client.from("events").select("type, payload").eq("type", "ticket_granted");
    expect(ev).toHaveLength(1);
    expect(ev![0].payload).toMatchObject({ reason: "sunrise", amount: 1 });
  });

  it("CJ-04 too late: time logged, NO ticket, in_window false", async () => {
    const u = await newUser("wake-late");
    if (localParts(new Date(), TZ).hour === 0 && localParts(new Date(), TZ).minute < 30) return;
    await setTargetMinutesAgo(u.client, 20);
    const { data } = await u.client.rpc("press_wake");
    expect(data).toMatchObject({ in_window: false });
    expect(Math.abs(new Date(data.pressed_at).getTime() - Date.now())).toBeLessThan(60_000);
    expect(await tickets(u.client)).toBe(0);
  });

  it("concurrent presses grant at most one ticket", async () => {
    const u = await newUser("wake-race");
    if (localParts(new Date(), TZ).hour === 0 && localParts(new Date(), TZ).minute < 30) return;
    await setTargetMinutesAgo(u.client, 5);
    await Promise.all(Array.from({ length: 5 }, () => u.client.rpc("press_wake")));
    expect(await tickets(u.client)).toBe(1);
  });

  it("CJ-06 backfill: counts, labeled backfilled, never a ticket; no future backfill", async () => {
    const u = await newUser("wake-back");
    const { data, error } = await u.client.rpc("backfill_wake", {
      p_date: "2026-10-01",
      p_pressed_at: "2026-10-01T03:00:00Z",
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ backfilled: true });
    expect(await tickets(u.client)).toBe(0);
    const future = await u.client.rpc("backfill_wake", {
      p_date: "2099-01-01",
      p_pressed_at: "2099-01-01T03:00:00Z",
    });
    expect(future.error).not.toBeNull();
  });

  it("clients can't insert or edit wake events directly (no free tickets by spoofing)", async () => {
    const u = await newUser("wake-spoof");
    const ins = await u.client.from("wake_events").insert({
      user_id: u.id,
      date: "2026-10-02",
      target_wake: "2026-10-02T03:00:00Z",
      pressed_at: "2026-10-02T03:00:00Z",
      in_window: true,
    });
    expect(ins.error?.code).toBe("42501");
  });

  it("the ticket helper isn't callable by users", async () => {
    const u = await newUser("wake-helper");
    const { error } = await u.client.rpc("_grant_tickets", { uid: u.id, amount: 100, reason: "hack" });
    expect(error).not.toBeNull();
    expect(await tickets(u.client)).toBe(0);
  });
});

describe("block_logs backfill guard (CJ-06)", () => {
  it("a live check-in stays live; an old timestamp is forced to backfilled", async () => {
    const u = await newUser("guard");
    const now = new Date().toISOString();
    const live = await u.client
      .from("block_logs")
      .insert({ user_id: u.id, date: "2026-11-02", block: "focus", started_at: now, backfilled: false })
      .select()
      .single();
    expect(live.data!.backfilled).toBe(false);
    const old = await u.client
      .from("block_logs")
      .insert({
        user_id: u.id,
        date: "2026-11-01",
        block: "focus",
        started_at: "2026-11-01T04:00:00Z",
        backfilled: false,
      })
      .select()
      .single();
    expect(old.data!.backfilled).toBe(true);
    // Once backfilled, it can't be flipped back.
    const flip = await u.client
      .from("block_logs")
      .update({ backfilled: false })
      .eq("id", old.data!.id)
      .select()
      .single();
    expect(flip.data!.backfilled).toBe(true);
    // Setting an old first-10 on the live log also marks it.
    const late = await u.client
      .from("block_logs")
      .update({ first10_at: "2026-11-02T00:00:00Z" })
      .eq("id", live.data!.id)
      .select()
      .single();
    expect(late.data!.backfilled).toBe(true);
  });
});
