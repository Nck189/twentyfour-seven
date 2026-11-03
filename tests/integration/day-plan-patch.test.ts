import { describe, expect, it } from "vitest";
import { localDate } from "@/lib/time";
import { newUser } from "./helpers";

/** G7 re-review R-M3-4: two devices/screens don't overwrite each other's day-plan edits. */
describe("patch_day_plan merges instead of overwriting", () => {
  const date = localDate(new Date(Date.now() + 3 * 86_400_000), "Asia/Bangkok");

  it("Sick set on the phone survives a bedtime + Focus edit from Plan on the Mac", async () => {
    const u = await newUser("patch-merge");
    await u.client
      .from("day_plans")
      .upsert({ user_id: u.id, date, mode: "sick" }, { onConflict: "user_id,date" });
    const bedtime = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const r1 = await u.client.rpc("patch_day_plan", {
      p_date: date,
      p_set: { bedtime_override: bedtime },
      p_blocks: { focus: { first10: "Open notes" } },
    });
    expect(r1.error).toBeNull();
    const r2 = await u.client.rpc("patch_day_plan", {
      p_date: date,
      p_set: {},
      p_blocks: { work: { checklist: [{ id: "a", label: "Slides" }] } },
    });
    expect(r2.error).toBeNull();
    const { data } = await u.client.from("day_plans").select("*").eq("date", date).single();
    expect(data!.mode).toBe("sick");
    expect(new Date(data!.bedtime_override).toISOString()).toBe(bedtime);
    expect(data!.overrides.blocks).toEqual({
      focus: { first10: "Open notes" },
      work: { checklist: [{ id: "a", label: "Slides" }] },
    });
  });

  it("clearing a field works (null), and someone else's template can't be picked", async () => {
    const u = await newUser("patch-null");
    const other = await newUser("patch-other");
    await u.client.rpc("patch_day_plan", {
      p_date: date,
      p_set: { late_night: { return_at: new Date().toISOString() } },
    });
    await u.client.rpc("patch_day_plan", { p_date: date, p_set: { late_night: null } });
    const { data } = await u.client.from("day_plans").select("late_night").eq("date", date).single();
    expect(data!.late_night).toBeNull();
    const { data: tpl } = await other.client.from("templates").select("id").limit(1).single();
    const bad = await u.client.rpc("patch_day_plan", { p_date: date, p_set: { template_id: tpl!.id } });
    expect(bad.error).not.toBeNull();
  });
});
