import { describe, expect, it } from "vitest";
import { addDays, localDate, localParts, zonedInstant } from "@/lib/time";
import { admin, newUser } from "./helpers";

/** G7 re-review 2 (docs/qa/G7-rereview-2-2026-11-03.md): R3-1, R3-3, R3-4, R3-5. */
const TZ = "Asia/Bangkok";
const MIN = 60_000;
const H = 60 * MIN;
const today = () => localDate(new Date(), TZ);
const hhmm = (ms: number) => {
  const p = localParts(new Date(Date.now() + ms), TZ);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};
/** Today's local instant at now + ms, rounded down to the minute (as an "HH:MM" target is). */
const baseAt = (ms: number) => {
  const p = localParts(new Date(Date.now() + ms), TZ);
  return zonedInstant(today(), p.hour * 60 + p.minute, TZ);
};
const sameDay = (ms: number) => localDate(new Date(Date.now() + ms), TZ) === today();
async function kindsAt(id: string, target: string) {
  await admin().from("templates").update({ target_wake: target, options: {} }).eq("user_id", id);
  await admin().from("wake_snapshots").delete().eq("user_id", id);
}
/** A plan saved long ago (as the app does on a wake-moving edit). */
async function plannedLongAgo(id: string, wake: Date, base: Date, extra: Record<string, unknown> = {}) {
  await admin()
    .from("day_plans")
    .upsert(
      {
        user_id: id,
        date: today(),
        planned: { wake: wake.toISOString(), base: base.toISOString() },
        wake_planned_at: new Date(Date.now() - 6 * H).toISOString(),
        ...extra,
      },
      { onConflict: "user_id,date" },
    );
  await admin().from("wake_snapshots").delete().eq("user_id", id);
}

describe("R3-1: the server judges the target Today shows", () => {
  it("(a) an early appointment pulls the wake 4 h earlier: pressing at the shown time pays", async () => {
    if (!sameDay(4 * H)) return;
    const u = await newUser("r31a");
    await kindsAt(u.id, hhmm(4 * H));
    await plannedLongAgo(u.id, new Date(), baseAt(4 * H));
    const { data } = await u.client.rpc("press_wake");
    expect(data.in_window).toBe(true);
  });

  it("(b) a kind moved after a (non-push) plan was saved: the server follows the kind", async () => {
    if (!sameDay(5 * H) || !sameDay(-30 * MIN)) return;
    const u = await newUser("r31b");
    await kindsAt(u.id, hhmm(5 * H));
    await plannedLongAgo(u.id, baseAt(5 * H), baseAt(5 * H)); // planned = the kind's own time
    await kindsAt(u.id, hhmm(-10 * MIN)); // later the kind moves (long ago, in this test's terms)
    const { data } = await u.client.rpc("press_wake");
    expect(data.in_window).toBe(true);
  });

  it("a push stays valid after the kind changes (pushes are absolute)", async () => {
    if (!sameDay(-2 * H)) return;
    const u = await newUser("r31c");
    await kindsAt(u.id, hhmm(-2 * H));
    await plannedLongAgo(u.id, new Date(), baseAt(-3 * H), {
      bedtime_override: new Date(Date.now() - 8 * H).toISOString(),
    });
    const { data } = await u.client.rpc("press_wake");
    expect(data.in_window).toBe(true);
  });

  it("a 'plan' more than 6 h earlier than the kind doesn't count", async () => {
    if (!sameDay(7 * H)) return;
    const u = await newUser("r31d");
    await kindsAt(u.id, hhmm(7 * H));
    await plannedLongAgo(u.id, new Date(), baseAt(7 * H));
    const { data } = await u.client.rpc("press_wake");
    expect(data.in_window).toBe(false);
  });
});

describe("R3-4: one statement touching two users freezes each at their own target", () => {
  it("B keeps B's target", async () => {
    const a = await newUser("r34a");
    const b = await newUser("r34b");
    await kindsAt(a.id, hhmm(1 * H));
    await kindsAt(b.id, hhmm(8 * H));
    // One statement for both users; A's change is near (freezes), B's moves B near too.
    await admin()
      .from("templates")
      .update({ target_wake: hhmm(30 * MIN) })
      .in("user_id", [a.id, b.id]);
    const { data: snaps } = await admin()
      .from("wake_snapshots")
      .select("user_id, date, target_wake")
      .in("user_id", [a.id, b.id])
      .eq("date", localDate(new Date(Date.now() + 30 * MIN), TZ));
    const bSnap = snaps!.find((s) => s.user_id === b.id);
    expect(bSnap).toBeTruthy();
    // B's frozen target is B's old one (≈ +8 h, or that time on the snapshot's date), not A's +1 h.
    const aOld = new Date(Date.now() + 1 * H).getTime();
    expect(Math.abs(new Date(bSnap!.target_wake).getTime() - aOld)).toBeGreaterThan(2 * H);
  });
});

describe("R3-3: a short night still earns the Night ticket", () => {
  it("Goodnight 4 h before the next wake (home 03:00 before a 07:00 class): ticket", async () => {
    const u = await newUser("r33");
    const at = new Date(Date.now() + 4 * H);
    await kindsAt(u.id, hhmm(4 * H));
    const night = addDays(localDate(at, TZ), -1);
    const r = await u.client.rpc("complete_night_ritual", { p_date: night });
    expect(r.data).toMatchObject({ ticket_granted: true, in_time: true });
  });
});

describe("R3-5: appointments are added and removed one by one in SQL", () => {
  it("two devices add, one removes: both adds kept, the removed one gone, retries are no-ops", async () => {
    const u = await newUser("r35");
    const date = addDays(today(), 20);
    const dentist = {
      id: "a1",
      key: "appointment",
      title: "Dentist",
      start: "14:00",
      end: "15:00",
      host: "work",
    };
    const dinner = {
      id: "a2",
      key: "appointment",
      title: "Dinner",
      start: "19:00",
      end: "20:00",
      host: "free",
    };
    expect(
      (await u.client.rpc("patch_day_plan", { p_date: date, p_add_events: [dentist] })).error,
    ).toBeNull();
    await u.client.rpc("patch_day_plan", { p_date: date, p_add_events: [dinner] });
    await u.client.rpc("patch_day_plan", { p_date: date, p_add_events: [dentist] }); // retried add
    let row = (await u.client.from("day_plans").select("overrides").eq("date", date).single()).data!;
    expect(row.overrides.fixed_events.map((e: { id: string }) => e.id)).toEqual(["a1", "a2"]);
    await u.client.rpc("patch_day_plan", { p_date: date, p_remove_event_ids: ["a1"] });
    row = (await u.client.from("day_plans").select("overrides").eq("date", date).single()).data!;
    expect(row.overrides.fixed_events.map((e: { id: string }) => e.id)).toEqual(["a2"]);
  });

  it("deleting a user whose target is near (and nothing frozen yet) doesn't roll back", async () => {
    const u = await newUser("r35del");
    await kindsAt(u.id, hhmm(30 * MIN)); // near target, snapshots cleared: deletion would freeze
    await admin()
      .from("day_plans")
      .upsert({ user_id: u.id, date: today(), mode: "sick" }, { onConflict: "user_id,date" });
    await admin().from("wake_snapshots").delete().eq("user_id", u.id);
    const { error } = await admin().auth.admin.deleteUser(u.id);
    expect(error).toBeNull();
  });
});
