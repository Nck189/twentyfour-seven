import { describe, expect, it } from "vitest";
import type { BlockKey } from "@/content/blocks";
import type { CropId } from "@/content/crops";
import { buildDayFacts, farmState, type DayMode, type LogRow, type Planting } from "@/lib/game";
import { addDays, localDate, zonedInstant } from "@/lib/time";
import { admin, newUser } from "./helpers";

/**
 * M6 farm RPCs (supabase/migrations/20261103060000_m6_farm.sql): planting and harvesting are
 * server-side, and the server's "ripe" agrees with lib/game on a seeded week (BUILD_PLAN M6
 * done-when: "a seeded week of logs produces the correct farm state").
 */
const TZ = "Asia/Bangkok";
const T = () => localDate(new Date(), TZ);
const at = (date: string, min: number) => zonedInstant(date, min, TZ).toISOString();

type Kind = "good" | "late" | "excused" | "backfilled" | "checklist";
function logRow(user_id: string, date: string, block: BlockKey, kind: Kind) {
  const start = 9 * 60;
  return {
    user_id,
    date,
    block,
    planned_start: at(date, start),
    started_at: at(date, start + (kind === "good" || kind === "backfilled" || kind === "excused" ? 5 : 30)),
    first10_at: kind === "good" ? at(date, start + 15) : null,
    items_planned: kind === "checklist" ? 10 : 0,
    items_done: kind === "checklist" ? ["a", "b", "c", "d", "e", "f", "g"] : [],
    backfilled: kind === "backfilled",
    planned_deviation: kind === "excused",
    miss_reason: null,
    location: "home",
  };
}

async function loadFacts(id: string, from: string, today: string) {
  const a = admin();
  const [logs, plans, wakes, grants, ex] = await Promise.all([
    a.from("block_logs").select("*").eq("user_id", id).gte("date", from),
    a.from("day_plans").select("date, mode, late_night").eq("user_id", id).gte("date", from),
    a.from("wake_events").select("date, in_window, backfilled").eq("user_id", id).gte("date", from),
    a.from("ticket_grants").select("ref_date").eq("user_id", id).eq("reason", "night").gte("ref_date", from),
    a.from("exercise_logs").select("at").eq("user_id", id),
  ]);
  return buildDayFacts({
    from,
    today,
    timezone: TZ,
    logs: (logs.data ?? []) as LogRow[],
    lateNights: (plans.data ?? []).filter((p) => p.late_night).map((p) => p.date as string),
    modes: Object.fromEntries((plans.data ?? []).map((p) => [p.date, p.mode as DayMode])),
    wakes: wakes.data ?? [],
    nights: (grants.data ?? []).map((g) => g.ref_date as string),
    exercise: (ex.data ?? []).map((e) => e.at as string),
  });
}

describe("plant_seed", () => {
  it("plants a starter seed in an empty block plot, on the server's wake-day", async () => {
    const u = await newUser("plant");
    const { data, error } = await u.client.rpc("plant_seed", { p_slot: "focus", p_crop: "radish" });
    expect(error).toBeNull();
    expect(data).toMatchObject({ slot: "focus", crop_id: "radish", state: "growing", star: 1 });
    expect([T(), addDays(T(), -1)]).toContain(data.planted_on);
    const { data: ev } = await u.client.from("events").select("type, payload").eq("type", "seed_planted");
    expect(ev).toHaveLength(1);
  });

  it("refuses a busy plot unless replacing, seeds you don't have, and unknown plots", async () => {
    const u = await newUser("plant2");
    await u.client.rpc("plant_seed", { p_slot: "work", p_crop: "carrot" });
    const busy = await u.client.rpc("plant_seed", { p_slot: "work", p_crop: "lettuce" });
    expect(busy.error?.code).toBe("23505");
    const replaced = await u.client.rpc("plant_seed", { p_slot: "work", p_crop: "lettuce", p_replace: true });
    expect(replaced.data).toMatchObject({ crop_id: "lettuce" });
    const rare = await u.client.rpc("plant_seed", { p_slot: "free", p_crop: "star_fruit" });
    expect(rare.error?.code).toBe("42501");
    const field = await u.client.rpc("plant_seed", { p_slot: "field_1", p_crop: "radish" });
    expect(field.error?.code).toBe("22023");
  });

  it("clients still can't write plots or fake planting/harvest events", async () => {
    const u = await newUser("plant3");
    const upd = await u.client
      .from("plots")
      .update({ crop_id: "star_fruit", planted_on: "2020-01-01" })
      .eq("slot", "focus")
      .select();
    expect(upd.data ?? []).toEqual([]);
    for (const type of ["seed_planted", "harvest"]) {
      const ins = await u.client.from("events").insert({ user_id: u.id, type, payload: {} });
      expect(ins.error?.code).toBe("42501");
    }
  });
});

describe("harvest_plot", () => {
  it("refuses an empty plot and an unripe crop", async () => {
    const u = await newUser("harv");
    expect((await u.client.rpc("harvest_plot", { p_slot: "wake" })).error?.code).toBe("P0002");
    await u.client.rpc("plant_seed", { p_slot: "wake", p_crop: "radish" });
    expect((await u.client.rpc("harvest_plot", { p_slot: "wake" })).error?.code).toBe("22023");
  });

  it("server ripeness = lib/game on a seeded week; harvest pays produce once; regrow stays", async () => {
    const u = await newUser("harv-week");
    const t = T();
    const d = (n: number) => addDays(t, -n);
    const planted = d(9);
    const crops: Record<BlockKey, CropId> = {
      wake: "radish",
      sleep: "tomato",
      down: "dragon_fruit",
      focus: "carrot",
      work: "lettuce",
      gradation: "turnip",
      free: "corn",
    };
    const a = admin();
    for (const [slot, crop] of Object.entries(crops)) {
      await a
        .from("plots")
        .update({ crop_id: crop, planted_on: planted, state: "growing" })
        .eq("user_id", u.id)
        .eq("slot", slot);
    }
    const logs = [
      // wake: radish (1 day) — success the day after planting → ripe
      logRow(u.id, d(8), "wake", "good"),
      // sleep: tomato (2 days, regrows) → ripe
      logRow(u.id, d(8), "sleep", "good"),
      logRow(u.id, d(7), "sleep", "good"),
      // down: dragon fruit (5) — 2 days, a miss on d6 (weeds, never a minimum day after) → not ripe
      logRow(u.id, d(8), "down", "good"),
      logRow(u.id, d(7), "down", "good"),
      logRow(u.id, d(5), "down", "good"),
      logRow(u.id, d(4), "down", "good"),
      // focus: carrot (1) — miss d8 (weeds), d7 success but weedy; d7 is a minimum day → clear;
      // d6 success → ripe
      logRow(u.id, d(7), "focus", "good"),
      logRow(u.id, d(6), "focus", "good"),
      // work: lettuce (1) — 5 misses → dead, a later success doesn't help
      logRow(u.id, d(3), "work", "good"),
      // gradation: turnip (1) — excused ×3, late, backfilled, then a late start with 70% checklist
      logRow(u.id, d(8), "gradation", "excused"),
      logRow(u.id, d(7), "gradation", "excused"),
      logRow(u.id, d(6), "gradation", "excused"),
      logRow(u.id, d(5), "gradation", "late"),
      logRow(u.id, d(4), "gradation", "backfilled"),
      logRow(u.id, d(3), "gradation", "checklist"),
      // free: corn (2) — 1 day, then misses → dead
      logRow(u.id, d(8), "free", "good"),
    ];
    expect((await a.from("block_logs").insert(logs)).error).toBeNull();
    // d7 is a minimum day: a live in-window "I'm up" + the Night ticket.
    expect(
      (
        await a.from("wake_events").insert({
          user_id: u.id,
          date: d(7),
          target_wake: at(d(7), 8 * 60),
          pressed_at: at(d(7), 8 * 60),
          in_window: true,
          backfilled: false,
        })
      ).error,
    ).toBeNull();
    expect(
      (await a.from("ticket_grants").insert({ user_id: u.id, reason: "night", ref_date: d(7), amount: 1 }))
        .error,
    ).toBeNull();

    const expected: Record<BlockKey, boolean> = {
      wake: true,
      sleep: true,
      down: false,
      focus: true,
      work: false,
      gradation: true,
      free: false,
    };
    // lib/game agrees whichever wake-day the server is on (before/after today's wake).
    const plantings: Planting[] = Object.entries(crops).map(([slot, cropId]) => ({
      slot: slot as BlockKey,
      cropId,
      star: 1,
      plantedOn: planted,
    }));
    for (const today of [t, d(1)]) {
      const farm = farmState(plantings, await loadFacts(u.id, d(10), today), u.id);
      for (const [slot, ripe] of Object.entries(expected)) {
        expect([slot, farm.plots[slot as BlockKey]!.status === "ready"]).toEqual([slot, ripe]);
      }
    }
    // The server agrees.
    for (const [slot, ripe] of Object.entries(expected)) {
      const r = await u.client.rpc("harvest_plot", { p_slot: slot });
      expect([slot, r.error === null]).toEqual([slot, ripe]);
    }
    // Produce in the inventory; regrowing tomato stays, the others leave the plot empty.
    const { data: inv } = await u.client.from("inventory").select("item_id, qty").order("item_id");
    expect(inv).toEqual([
      { item_id: "crop:carrot", qty: 1 },
      { item_id: "crop:radish", qty: 1 },
      { item_id: "crop:tomato", qty: 1 },
      { item_id: "crop:turnip", qty: 1 },
    ]);
    const { data: plots } = await u.client
      .from("plots")
      .select("slot, crop_id")
      .in("slot", ["wake", "sleep"]);
    expect(Object.fromEntries(plots!.map((p) => [p.slot, p.crop_id]))).toEqual({
      wake: null,
      sleep: "tomato",
    });
    // A second harvest the same day: nothing ripe.
    expect((await u.client.rpc("harvest_plot", { p_slot: "sleep" })).error?.code).toBe("22023");
  });
});

describe("buy_decor (SPEC §8.9)", () => {
  it("costs coins atomically, never below zero; the item lands on the farm", async () => {
    const u = await newUser("decor");
    expect((await u.client.rpc("buy_decor", { p_item: "fence" })).error?.code).toBe("P0001");
    await admin().from("game_state").update({ coins: 100 }).eq("user_id", u.id);
    const r = await u.client.rpc("buy_decor", { p_item: "fence" });
    expect(r.error).toBeNull();
    expect(r.data).toMatchObject({ item: "fence", coins: 60 });
    // Two at once with 60 coins and a 50-coin item: exactly one goes through.
    const both = await Promise.all([
      u.client.rpc("buy_decor", { p_item: "flowers" }),
      u.client.rpc("buy_decor", { p_item: "flowers" }),
    ]);
    expect(both.filter((x) => x.error === null)).toHaveLength(1);
    const { data: gs } = await u.client.from("game_state").select("coins").single();
    expect(gs!.coins).toBe(10);
    const { data: decor } = await u.client.from("decor").select("item_id").order("item_id");
    expect(decor).toEqual([{ item_id: "fence" }, { item_id: "flowers" }]);
    expect((await u.client.rpc("buy_decor", { p_item: "castle" })).error?.code).toBe("22023");
    const fake = await u.client.from("events").insert({ user_id: u.id, type: "decor_bought", payload: {} });
    expect(fake.error?.code).toBe("42501");
  });
});

describe("G7 M6 review fixes", () => {
  it("R-M6-1: a client can't log a block for a future day", async () => {
    const u = await newUser("future");
    const later = addDays(T(), 7);
    const ins = await u.client.from("block_logs").insert({
      user_id: u.id,
      date: later,
      block: "wake",
      items_planned: 1,
      items_done: ["x"],
    });
    expect(ins.error?.code).toBe("22023");
    const rpc = await u.client.rpc("set_block_item", {
      p_date: later,
      p_block: "wake",
      p_item: "x",
      p_done: true,
      p_items_planned: 1,
      p_planned_start: null,
    });
    expect(rpc.error).not.toBeNull();
  });

  it("R-M6-2: out late before D excuses D−1's Free on the server too", async () => {
    const u = await newUser("late");
    const t = T();
    const d = (n: number) => addDays(t, -n);
    const a = admin();
    await a
      .from("plots")
      .update({ crop_id: "carrot", planted_on: d(5), state: "growing" })
      .eq("user_id", u.id)
      .eq("slot", "free");
    // d4: Free skipped while out late (planned on d3's day plan); d3: Free on time → ripe.
    await a.from("day_plans").upsert(
      // Saved on d4's evening, before the night (only an Out late saved in time excuses, R-M9-1).
      {
        user_id: u.id,
        date: d(3),
        late_night: { return_at: at(d(3), 60) },
        late_night_set_at: at(d(4), 18 * 60),
      },
      { onConflict: "user_id,date" },
    );
    expect((await a.from("block_logs").insert(logRow(u.id, d(3), "free", "good"))).error).toBeNull();
    const plantings: Planting[] = [{ slot: "free", cropId: "carrot", star: 1, plantedOn: d(5) }];
    const farm = farmState(plantings, await loadFacts(u.id, d(6), t), u.id);
    expect(farm.plots.free).toMatchObject({ status: "ready", weeds: false });
    expect((await u.client.rpc("harvest_plot", { p_slot: "free" })).error).toBeNull();
  });
});
