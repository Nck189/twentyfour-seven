import { describe, expect, it } from "vitest";
import { addDays, localDate, localParts } from "@/lib/time";
import { admin, newUser } from "./helpers";

/** G7 re-review 2026-11-03 (docs/qa/G7-rereview-2026-11-03.md): R2-1, R2-2, R2-7, R2-8, deletion. */
const TZ = "Asia/Bangkok";
const MIN = 60_000;
const H = 60 * MIN;
const hhmm = (msFromNow: number) => {
  const p = localParts(new Date(Date.now() + msFromNow), TZ);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};
async function targetsLongAgo(id: string, target: string) {
  await admin().from("templates").update({ target_wake: target, options: {} }).eq("user_id", id);
  await admin().from("wake_snapshots").delete().eq("user_id", id);
}

describe("R2-1: a kind-of-day edit that brings a target within 4 h is frozen out — tomorrow too", () => {
  it("23:55 → wake 00:30 style edits keep the old target", async () => {
    const u = await newUser("r21");
    await targetsLongAgo(u.id, hhmm(5 * H));
    const soon = new Date(Date.now() + 30 * MIN);
    await u.client
      .from("templates")
      .update({ target_wake: hhmm(30 * MIN) })
      .neq("key", "");
    const day = localDate(soon, TZ); // today, or tomorrow just before midnight
    const { data: snap } = await admin()
      .from("wake_snapshots")
      .select("target_wake")
      .eq("user_id", u.id)
      .eq("date", day)
      .single();
    expect(snap).toBeTruthy();
    expect(Math.abs(new Date(snap!.target_wake).getTime() - soon.getTime())).toBeGreaterThan(H);
    if (day === localDate(new Date(), TZ)) {
      const { data } = await u.client.rpc("press_wake");
      expect(data.in_window).toBe(false);
    }
  });
});

describe("R2-2: profiles and settings can't be deleted/re-inserted; the window stays 5–30 min", () => {
  it("delete and insert do nothing; a 120-min window is rejected", async () => {
    const u = await newUser("r22");
    await u.client.from("settings").delete().eq("user_id", u.id);
    await u.client.from("profiles").delete().eq("user_id", u.id);
    expect((await admin().from("settings").select("user_id").eq("user_id", u.id)).data).toHaveLength(1);
    expect((await admin().from("profiles").select("user_id").eq("user_id", u.id)).data).toHaveLength(1);
    const ins = await u.client.from("settings").insert({ user_id: u.id });
    expect(ins.error).not.toBeNull();
    const wide = await u.client.from("settings").update({ wake_window_min: 120 }).eq("user_id", u.id);
    expect(wide.error).not.toBeNull();
  });
});

describe("R2-7: the daily coin cap holds under parallel finishes", () => {
  it("7 Must tasks finished at once pay 150, not 210", async () => {
    const u = await newUser("r27");
    const yesterday = new Date(Date.now() - 24 * H).toISOString();
    const { data: items } = await admin()
      .from("backlog_items")
      .insert(
        Array.from({ length: 7 }, (_, i) => ({
          user_id: u.id,
          title: `m${i}`,
          priority: "must",
          created_at: yesterday,
          priority_set_at: yesterday,
        })),
      )
      .select("id");
    const results = await Promise.all(
      items!.map((i) => u.client.rpc("complete_backlog_item", { p_id: i.id })),
    );
    const total = results.reduce((s, r) => s + (r.data?.coins_granted ?? 0), 0);
    expect(total).toBe(150);
    const { data: g } = await u.client.from("game_state").select("coins").single();
    expect(g!.coins).toBe(150);
  });
});

describe("R2-8: no Night ticket in the morning", () => {
  it("woke early (90 min before the target) and closed last night: no ticket", async () => {
    const u = await newUser("r28");
    const at = new Date(Date.now() + 90 * MIN);
    await targetsLongAgo(u.id, hhmm(90 * MIN));
    const lastNight = addDays(localDate(at, TZ), -1);
    const r = await u.client.rpc("complete_night_ritual", { p_date: lastNight });
    expect(r.data).toMatchObject({ ticket_granted: false, in_time: false });
  });
});

describe("account deletion still works with the freeze triggers", () => {
  it("deleting a user with plans and kinds of day doesn't roll back", async () => {
    const u = await newUser("del");
    await u.client
      .from("templates")
      .update({ target_wake: hhmm(30 * MIN) })
      .neq("key", "");
    await u.client.rpc("patch_day_plan", { p_date: localDate(new Date(), TZ), p_set: { mode: "sick" } });
    const { error } = await admin().auth.admin.deleteUser(u.id);
    expect(error).toBeNull();
    expect((await admin().from("templates").select("id").eq("user_id", u.id)).data).toEqual([]);
  });
});
