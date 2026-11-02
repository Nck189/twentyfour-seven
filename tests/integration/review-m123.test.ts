import { describe, expect, it } from "vitest";
import { addDays, localDate, localParts } from "@/lib/time";
import { newUser } from "./helpers";

const today = () => localDate(new Date(), "Asia/Bangkok");

/** Regressions for the M1–M3 independent review (docs/qa/M3-report.md). */
describe("review M1–M3 security regressions", () => {
  it("M3-F1: a client-written planned.wake can't open the Sunrise window", async () => {
    const u = await newUser("f1");
    // Template target 12 h from now (outside the 3 h early window and the late window at any time
    // of day), so only the fake snapshot could make this "on time".
    const far = localParts(new Date(Date.now() + 12 * 3_600_000), "Asia/Bangkok");
    const target = `${String(far.hour).padStart(2, "0")}:${String(far.minute).padStart(2, "0")}`;
    await u.client.from("templates").update({ target_wake: target, options: {} }).neq("key", "");
    await u.client
      .from("day_plans")
      .upsert(
        { user_id: u.id, date: today(), planned: { wake: new Date().toISOString() } },
        { onConflict: "user_id,date" },
      );
    const { data } = await u.client.rpc("press_wake");
    expect(data.in_window).toBe(false);
    const { data: g } = await u.client.from("game_state").select("tickets").single();
    expect(g!.tickets).toBe(0);
  });

  it("M1-F1: plots are read-only for clients", async () => {
    const u = await newUser("plots");
    const upd = await u.client
      .from("plots")
      .update({ quality: "prismatic", star: 5, state: "ready" })
      .eq("user_id", u.id)
      .select();
    expect(upd.data ?? []).toEqual([]);
    const ins = await u.client
      .from("plots")
      .insert({ user_id: u.id, slot: "field_99", crop_id: "star_fruit" });
    expect(ins.error?.code).toBe("42501");
    const { data } = await u.client.from("plots").select("quality, star").limit(1).single();
    expect(data).toEqual({ quality: "normal", star: 1 });
  });

  it("M1-F3: clients can't insert server-only event types", async () => {
    const u = await newUser("events");
    for (const type of ["ticket_granted", "wake_pressed", "night_ritual_completed", "wake_backfilled"]) {
      const { error } = await u.client
        .from("events")
        .insert({ user_id: u.id, type, payload: { amount: 1000 } });
      expect(error?.code, type).toBe("42501");
    }
    expect((await u.client.from("events").insert({ user_id: u.id, type: "item_done" })).error).toBeNull();
  });

  it("M3-F4: backfill_wake only accepts past dates within 30 days", async () => {
    const u = await newUser("bf");
    const now = new Date().toISOString();
    expect(
      (await u.client.rpc("backfill_wake", { p_date: today(), p_pressed_at: now })).error,
    ).not.toBeNull();
    expect(
      (await u.client.rpc("backfill_wake", { p_date: addDays(today(), 1), p_pressed_at: now })).error,
    ).not.toBeNull();
    expect(
      (await u.client.rpc("backfill_wake", { p_date: "1999-01-01", p_pressed_at: "1999-01-01T03:00:00Z" }))
        .error,
    ).not.toBeNull();
    const ok = await u.client.rpc("backfill_wake", {
      p_date: addDays(today(), -2),
      p_pressed_at: new Date(Date.now() - 2 * 86400_000).toISOString(),
    });
    expect(ok.error).toBeNull();
  });

  it("M3-F8: a check-in on an old date is backfilled even with a fresh timestamp", async () => {
    const u = await newUser("old");
    const { data } = await u.client
      .from("block_logs")
      .insert({
        user_id: u.id,
        date: addDays(today(), -10),
        block: "focus",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();
    expect(data!.backfilled).toBe(true);
  });
});
