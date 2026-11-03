import { describe, expect, it } from "vitest";
import { localDate, localParts, zonedInstant } from "@/lib/time";
import { admin, newUser } from "./helpers";

/**
 * G7 re-review R-M3-1 / R-M3-2 / R-M4-1 (S1): the Sunrise target can't be moved after the fact,
 * and a push planned the night before counts (docs/qa/G7-M1-M3.md).
 */
const TZ = "Asia/Bangkok";
const today = () => localDate(new Date(), TZ);
const hhmm = (msFromNow: number) => {
  const p = localParts(new Date(Date.now() + msFromNow), TZ);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};
const MIN = 60_000;
/** True when (now − 3 h) is still today, so "today's target was hours ago" can be set up. */
const roomBefore = () => localDate(new Date(Date.now() - 3 * 60 * MIN), TZ) === today();
/** Today's local instant at now + ms, rounded down to the minute (as an "HH:MM" target is). */
const baseAt = (ms: number) => {
  const p = localParts(new Date(Date.now() + ms), TZ);
  return zonedInstant(today(), p.hour * 60 + p.minute, TZ);
};

/** Every template targets `target` ("HH:MM"), as if set long ago (no snapshot). */
async function plannedLongAgo(id: string, target: string) {
  await admin().from("templates").update({ target_wake: target, options: {} }).eq("user_id", id);
  await admin().from("wake_snapshots").delete().eq("user_id", id);
}
const tickets = async (id: string) =>
  (await admin().from("game_state").select("tickets").eq("user_id", id).single()).data!.tickets;

describe("Sunrise target can't be moved after the fact (R-M3-1)", () => {
  it("overslept → set the template wake to now → I'm up: no ticket", async () => {
    if (!roomBefore()) return; // 3 h back would fall on the previous date
    const u = await newUser("frz-tpl");
    await plannedLongAgo(u.id, hhmm(-3 * 60 * MIN));
    const { error } = await u.client
      .from("templates")
      .update({ target_wake: hhmm(0) })
      .neq("key", "");
    expect(error).toBeNull();
    const { data } = await u.client.rpc("press_wake");
    expect(data.in_window).toBe(false);
    expect(await tickets(u.id)).toBe(0);
  });

  it("overslept → widen the wake window to 2 h → I'm up: no ticket", async () => {
    if (!roomBefore()) return;
    const u = await newUser("frz-win");
    await plannedLongAgo(u.id, hhmm(-60 * MIN));
    await u.client.from("settings").update({ wake_window_min: 120 }).eq("user_id", u.id);
    const { data } = await u.client.rpc("press_wake");
    expect(data.in_window).toBe(false);
    expect(await tickets(u.id)).toBe(0);
  });

  it("a 'planned' wake written right before pressing doesn't count", async () => {
    if (!roomBefore()) return;
    const u = await newUser("frz-plan");
    const target = hhmm(-90 * MIN);
    await plannedLongAgo(u.id, target);
    const base = baseAt(-90 * MIN);
    await u.client.from("day_plans").upsert(
      {
        user_id: u.id,
        date: today(),
        planned: { wake: new Date().toISOString(), base: base.toISOString() },
        wake_planned_at: new Date(Date.now() - 6 * 60 * MIN).toISOString(), // ignored for clients
      },
      { onConflict: "user_id,date" },
    );
    const { data } = await u.client.rpc("press_wake");
    expect(data.in_window).toBe(false);
    expect(await tickets(u.id)).toBe(0);
  });

  it("wake history can't be deleted (no re-press) (R-M1-4)", async () => {
    const u = await newUser("frz-del");
    await u.client.rpc("press_wake");
    await u.client.from("wake_events").delete().eq("user_id", u.id);
    const { data } = await admin().from("wake_events").select("id").eq("user_id", u.id);
    expect(data).toHaveLength(1);
  });

  it("clients can't write snapshots", async () => {
    const u = await newUser("frz-snap");
    const { error } = await u.client
      .from("wake_snapshots")
      .insert({ user_id: u.id, date: today(), target_wake: new Date().toISOString(), window_min: 600 });
    expect(error).not.toBeNull();
  });
});

describe("a push planned the night before moves the target (R-M3-2 / R-M4-1)", () => {
  it("template 90 min ago + bedtime pushed so wake = now, planned 6 h ago → I'm up: ticket", async () => {
    if (!roomBefore()) return;
    const u = await newUser("frz-push");
    await plannedLongAgo(u.id, hhmm(-90 * MIN));
    const base = baseAt(-90 * MIN);
    // As the app saves it from the Night ritual: the engine's wake + the template target it used.
    await admin()
      .from("day_plans")
      .upsert(
        {
          user_id: u.id,
          date: today(),
          bedtime_override: new Date(Date.now() - 8 * 60 * MIN).toISOString(),
          planned: { wake: new Date().toISOString(), base: base.toISOString() },
          wake_planned_at: new Date(Date.now() - 6 * 60 * MIN).toISOString(),
        },
        { onConflict: "user_id,date" },
      );
    await admin().from("wake_snapshots").delete().eq("user_id", u.id);
    const { data } = await u.client.rpc("press_wake");
    expect(data.in_window).toBe(true);
    expect(await tickets(u.id)).toBe(1);
  });
});
