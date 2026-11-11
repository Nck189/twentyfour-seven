import { describe, expect, it } from "vitest";
import { BLOCK_KEYS, type BlockKey } from "@/content/blocks";
import type { CropId } from "@/content/crops";
import { buildDayFacts, simulatePlot, type DayMode, type LogRow } from "@/lib/game";
import { addDays, zonedInstant } from "@/lib/time";
import { admin, newUser } from "./helpers";

/**
 * Economy v2 step 1: the server replays a planting (`_plot_harvest`) to price its produce. It
 * must agree with lib/game `simulatePlot` — the farm the user sees — on ripeness, quality and
 * weather. Random weeks (seeded, so a failure is reproducible) are fed to both.
 */
const TZ = "Asia/Bangkok";
const CROPS_BY_DAYS: CropId[] = ["radish", "tomato", "sunflower"]; // 1, 2, 3 grow days

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function scenario(seed: number) {
  const r = rng(seed);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;
  const u = await newUser(`parity-${seed}`);
  const today: string = (await u.client.rpc("settle_days")).data.today;
  const planted = addDays(today, -8);
  await admin()
    .from("profiles")
    .update({ created_at: zonedInstant(addDays(today, -20), 6 * 60, TZ).toISOString() })
    .eq("user_id", u.id);
  const slot = pick(["wake", "down", "focus", "work", "free"] as const satisfies readonly BlockKey[]);
  const cropId = pick(CROPS_BY_DAYS);
  const star = 1 + Math.floor(r() * 3);
  await admin()
    .from("plots")
    .update({ crop_id: cropId, planted_on: planted, state: "growing", star })
    .eq("user_id", u.id)
    .eq("slot", slot);

  const wakes: Record<string, unknown>[] = [];
  const nights: Record<string, unknown>[] = [];
  const logs: Record<string, unknown>[] = [];
  const exercise: Record<string, unknown>[] = [];
  for (let i = 7; i >= 1; i--) {
    const d = addDays(today, -i);
    const w = r();
    if (w < 0.7)
      wakes.push({
        user_id: u.id,
        date: d,
        target_wake: zonedInstant(d, 7 * 60, TZ).toISOString(),
        pressed_at: zonedInstant(d, 7 * 60 + 3, TZ).toISOString(),
        in_window: w < 0.6,
        backfilled: w >= 0.6,
      });
    if (r() < 0.65) nights.push({ user_id: u.id, reason: "night", ref_date: d, amount: 1 });
    if (r() < 0.3)
      exercise.push({
        user_id: u.id,
        at: zonedInstant(d, 12 * 60, TZ).toISOString(),
        type: "walk",
        minutes: 30,
      });
    for (const block of new Set<BlockKey>([slot, "wake", "down", "focus", "work"])) {
      const k = r();
      if (k < 0.2) continue; // nothing logged
      const start = zonedInstant(d, 9 * 60 + BLOCK_KEYS.indexOf(block) * 60, TZ);
      const lateBy = k < 0.55 ? 3 : 35; // on time or late
      const planned = Math.floor(r() * 4);
      const row: Record<string, unknown> = {
        user_id: u.id,
        date: d,
        block,
        planned_start: start.toISOString(),
        started_at: new Date(start.getTime() + lateBy * 60_000).toISOString(),
        first10_at: r() < 0.6 ? new Date(start.getTime() + (lateBy + 5) * 60_000).toISOString() : null,
        items_planned: planned,
        items_done: Array.from({ length: Math.floor(r() * (planned + 1)) }, (_, j) => `${block}-${j}`),
        location: r() < 0.25 ? "out" : "home",
        backfilled: k >= 0.75 && k < 0.85,
        miss_reason: k >= 0.85 && k < 0.95 ? "phone" : null,
        planned_deviation: k >= 0.95,
      };
      if (row.miss_reason) {
        row.started_at = null;
        row.first10_at = null;
      }
      logs.push(row);
    }
  }
  for (const [table, rows] of [
    ["wake_events", wakes],
    ["ticket_grants", nights],
    ["block_logs", logs],
    ["exercise_logs", exercise],
  ] as const) {
    if (rows.length) {
      const { error } = await admin().from(table).insert(rows);
      expect(error, `${table}: ${error?.message}`).toBeNull();
    }
  }

  // What the app shows (lib/game), from the same rows read back.
  const back = async (table: string, sel: string) =>
    ((await admin().from(table).select(sel).eq("user_id", u.id)).data ?? []) as unknown as Record<
      string,
      unknown
    >[];
  const days = buildDayFacts({
    from: addDays(planted, -1),
    today,
    timezone: TZ,
    logs: (await back("block_logs", "*")) as unknown as LogRow[],
    modes: {} as Record<string, DayMode>,
    wakes: (await back("wake_events", "date, in_window, backfilled")) as never,
    nights: (await back("ticket_grants", "ref_date, reason"))
      .filter((n) => n.reason === "night")
      .map((n) => n.ref_date as string),
    exercise: (await back("exercise_logs", "at")).map((e) => e.at as string),
  });
  const view = simulatePlot({ slot, cropId, star, plantedOn: planted }, days);
  if (process.env.PARITY_DEBUG)
    console.log(
      JSON.stringify({
        rec: view.record,
        wilt: view.wiltLevel,
        days: days.map((d) => ({
          date: d.date,
          away: d.away,
          w: d.wakeInWindow,
          n: d.nightRitualDone,
          log: d.logs[slot],
        })),
      }),
    );
  const res = await u.client.rpc("harvest_plot", { p_slot: slot });
  return { view, res, slot, cropId, star };
}

describe("server harvest = lib/game simulatePlot (random weeks)", () => {
  for (const seed of Array.from({ length: 40 }, (_, i) => i + 1)) {
    it(`seed ${seed}`, async () => {
      const { view, res, slot, cropId, star } = await scenario(seed);
      const ctx = JSON.stringify({
        slot,
        cropId,
        star,
        status: view.status,
        q: view.quality,
        m: view.multiplier,
      });
      if (view.status === "ready") {
        expect(res.error, ctx).toBeNull();
        expect(res.data.quality, ctx).toBe(view.quality);
        expect(Number(res.data.mult), ctx).toBeCloseTo(view.multiplier, 6);
      } else {
        expect(res.error?.code, ctx).toBe("22023");
      }
    });
  }
});
