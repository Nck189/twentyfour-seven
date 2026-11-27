import { describe, expect, it } from "vitest";
import { DEFAULT_BLOCKS, type BlockSetting } from "@/content/blocks";
import { addDays, localDate, zonedInstant } from "@/lib/time";
import { admin, newUser } from "./helpers";

/**
 * Rule B on the server: which blocks are tracked is dated (settings.blocks[].tracked_log), changed
 * only through `set_block_tracked` from the next wake-day, and read per day by the Day score
 * (`_day_oee`) and the farm (`_plot_harvest`), like lib/game.
 */
const TZ = "Asia/Bangkok";
type U = Awaited<ReturnType<typeof newUser>>;
const blocksOf = async (u: U) =>
  (await admin().from("settings").select("blocks").eq("user_id", u.id).single()).data!
    .blocks as BlockSetting[];
const logOf = async (u: U, k: string) => (await blocksOf(u)).find((b) => b.key === k)?.tracked_log ?? [];
/** Test setup only (service role): a dated log written straight in. */
async function setLog(u: U, k: string, log: { from: string; tracked: boolean }[]) {
  const blocks = (await blocksOf(u)).map((b) => (b.key === k ? { ...b, tracked_log: log } : b));
  expect((await admin().from("settings").update({ blocks }).eq("user_id", u.id)).error).toBeNull();
}
async function wake(u: U, d: string) {
  const at = zonedInstant(d, 7 * 60, TZ).toISOString();
  expect(
    (
      await admin().from("wake_events").insert({
        user_id: u.id,
        date: d,
        target_wake: at,
        pressed_at: at,
        in_window: true,
        backfilled: false,
      })
    ).error,
  ).toBeNull();
}

describe("tracked blocks (server)", () => {
  it("set_block_tracked dates the change from the next wake-day; a new account's setup counts from today", async () => {
    const u = await newUser("trk-rpc");
    const today: string = (await u.client.rpc("settle_days")).data.today;
    expect(
      (await u.client.rpc("set_block_tracked", { p_block: "focus", p_tracked: false })).error,
    ).toBeNull();
    expect(await logOf(u, "focus")).toEqual([{ from: addDays(today, 1), tracked: false }]);
    // Same day again replaces it; setup (a new account) may start today.
    await u.client.rpc("set_block_tracked", { p_block: "focus", p_tracked: false, p_now: true });
    expect(await logOf(u, "focus")).toEqual([{ from: today, tracked: false }]);
    // An older account can't start today.
    await admin()
      .from("profiles")
      .update({ created_at: new Date(Date.now() - 3 * 86_400_000).toISOString() })
      .eq("user_id", u.id);
    await u.client.rpc("set_block_tracked", { p_block: "focus", p_tracked: true, p_now: true });
    expect(await logOf(u, "focus")).toEqual([
      { from: today, tracked: false },
      { from: addDays(today, 1), tracked: true },
    ]);
    expect(
      (await u.client.rpc("set_block_tracked", { p_block: "wake", p_tracked: false })).error?.message,
    ).toBe("this block is always tracked");
  });

  it("other settings writes keep the log: a stale copy can't undo or backdate it", async () => {
    const u = await newUser("trk-keep");
    await u.client.rpc("set_block_tracked", { p_block: "work", p_tracked: false });
    const kept = await logOf(u, "work");
    // A stale copy without the log (e.g. Plan's save-as-default on another device)…
    const stale = DEFAULT_BLOCKS.map((b) => (b.key === "focus" ? { ...b, first10: "Open notes" } : b));
    expect((await u.client.from("settings").update({ blocks: stale }).eq("user_id", u.id)).error).toBeNull();
    expect(await logOf(u, "work")).toEqual(kept);
    expect((await blocksOf(u)).find((b) => b.key === "focus")?.first10).toBe("Open notes");
    // …and a hand-written backdated log are both ignored.
    const forged = (await blocksOf(u)).map((b) =>
      b.key === "work" ? { ...b, tracked_log: [{ from: "2020-01-01", tracked: false }] } : b,
    );
    await u.client.from("settings").update({ blocks: forged }).eq("user_id", u.id);
    expect(await logOf(u, "work")).toEqual(kept);
  });

  it("the Day score leaves out blocks untracked that day; Wake, Down Time and Sleep always count", async () => {
    const u = await newUser("trk-oee");
    const d = addDays(localDate(new Date(), TZ), -2);
    const at = (min: number) => zonedInstant(d, min, TZ).toISOString();
    const rows = (["wake", "down", "sleep", "work"] as const).map((block, i) => ({
      user_id: u.id,
      date: d,
      block,
      planned_start: at(8 * 60 + i * 60),
      started_at: at(8 * 60 + i * 60 + 3),
      first10_at: at(8 * 60 + i * 60 + 8),
    }));
    expect((await admin().from("block_logs").insert(rows)).error).toBeNull();
    const oee = async () => (await admin().rpc("_day_oee", { uid: u.id, d })).data as number;
    expect(await oee()).toBeCloseTo((4 / 7) * (4 / 7), 4);
    for (const k of ["focus", "gradation", "free"]) await setLog(u, k, [{ from: d, tracked: false }]);
    expect(await oee()).toBeCloseTo(1, 4);
    // Untracked only from the next day: that day still counts them.
    for (const k of ["focus", "gradation", "free"])
      await setLog(u, k, [{ from: addDays(d, 1), tracked: false }]);
    expect(await oee()).toBeCloseTo((4 / 7) * (4 / 7), 4);
  });

  it("an untracked plot grows on kept days; tracking it again later never takes that growth back (G7 B S2-3)", async () => {
    const u = await newUser("trk-grow");
    const today = localDate(new Date(), TZ);
    const d = (n: number) => addDays(today, -n);
    await setLog(u, "focus", [{ from: d(5), tracked: false }]);
    await admin()
      .from("plots")
      .update({ crop_id: "tomato", planted_on: d(4), state: "growing" })
      .eq("user_id", u.id)
      .eq("slot", "focus");
    // d3 kept (wake), d2 quiet, d1 kept (ritual only) → 2 growth days → a tomato is ripe.
    await wake(u, d(3));
    expect(
      (
        await admin()
          .from("ticket_grants")
          .insert({ user_id: u.id, reason: "night", ref_date: d(1), amount: 1 })
      ).error,
    ).toBeNull();
    // Tracking Focus again (from tomorrow) leaves those days untracked: still ripe.
    expect((await u.client.rpc("set_block_tracked", { p_block: "focus", p_tracked: true })).error).toBeNull();
    expect((await u.client.rpc("harvest_plot", { p_slot: "focus" })).error).toBeNull();
    const { data: inv } = await u.client.from("inventory").select("item_id");
    expect((inv ?? []).map((i) => (i.item_id as string).split(":").slice(0, 3).join(":"))).toEqual([
      "crop:tomato:normal",
    ]);
  });
});
