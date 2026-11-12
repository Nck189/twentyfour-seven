import { describe, expect, it } from "vitest";
import { addDays, zonedInstant } from "@/lib/time";
import { admin, newUser } from "./helpers";

/**
 * G7 R1-fixes F1 (S1): closing a block late (the Night ritual's "Today went as usual" or "Done")
 * must not turn a live, on-time start into a backfill — "backfilled" is about the start.
 */
const TZ = "Asia/Bangkok";

describe("a late close keeps a live start live", () => {
  it("closing an on-time Focus hours later leaves it not backfilled", async () => {
    const u = await newUser("close-late");
    // Today's wake-day, a block that started live 5 h ago and is closed now for 2 h ago.
    const d: string = (await u.client.rpc("settle_days")).data.today;
    const start = new Date(Date.now() - 5 * 3600_000);
    const ins = await admin()
      .from("block_logs")
      .insert({
        user_id: u.id,
        date: d,
        block: "focus",
        planned_start: start.toISOString(),
        started_at: new Date(start.getTime() + 2 * 60_000).toISOString(),
        backfilled: false,
      })
      .select()
      .single();
    expect(ins.error).toBeNull();
    const closed = await u.client
      .from("block_logs")
      .update({ closed_at: new Date(Date.now() - 2 * 3600_000).toISOString() })
      .eq("id", ins.data!.id)
      .select("backfilled, closed_at")
      .single();
    expect(closed.error).toBeNull();
    expect(closed.data!.backfilled).toBe(false);
  });

  it("a block first logged now for the past is still a backfill", async () => {
    const u = await newUser("close-late-2");
    const today: string = (await u.client.rpc("settle_days")).data.today;
    const d = addDays(today, -1);
    const start = zonedInstant(d, 9 * 60, TZ);
    const r = await u.client
      .from("block_logs")
      .insert({
        user_id: u.id,
        date: d,
        block: "work",
        planned_start: start.toISOString(),
        started_at: start.toISOString(),
        closed_at: new Date(start.getTime() + 60 * 60_000).toISOString(),
      })
      .select("backfilled")
      .single();
    expect(r.error).toBeNull();
    expect(r.data!.backfilled).toBe(true);
  });
});
