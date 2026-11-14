import { describe, expect, it } from "vitest";
import { CROPS } from "@/content/crops";
import { PRODUCE_IDS } from "@/content/animals";
import { MACHINE_IDS, MACHINES, PRODUCT_IDS, RECIPES, recipesFor } from "@/content/factory";
import {
  capacity,
  factoryKpi,
  hasRoom,
  inputValue,
  jobMinutes,
  jobState,
  missingInputs,
  nextStart,
  progress,
  takesPremium,
  wouldTake,
  type JobRow,
  type MachineRow,
} from "@/lib/game/factory";
import { parseItem, sellPrice } from "@/lib/game/market";

const T0 = new Date("2026-11-14T03:00:00Z");
const at = (min: number) => new Date(T0.getTime() + min * 60_000);
const iso = (min: number) => at(min).toISOString();
let n = 0;
const job = (
  machine: JobRow["machine_id"],
  start: number,
  ready: number,
  over: Partial<JobRow> = {},
): JobRow => ({
  id: `j${n++}`,
  machine_id: machine,
  recipe_id: "pickles",
  created_at: iso(start),
  start_at: iso(start),
  ready_at: iso(ready),
  collected_at: null,
  ...over,
});
const machine = (
  id: MachineRow["machine_id"],
  boughtMin = -60 * 24 * 30,
  over: Partial<MachineRow> = {},
): MachineRow => ({
  machine_id: id,
  speed_level: 0,
  capacity_level: 0,
  bought_at: iso(boughtMin),
  ...over,
});

describe("factory content (M13)", () => {
  it("every machine has recipes; inputs exist; processing pays about 1.3–1.7× the inputs", () => {
    for (const m of MACHINE_IDS) expect(recipesFor(m).length).toBeGreaterThan(0);
    for (const id of PRODUCT_IDS) {
      const r = RECIPES[id];
      expect(r.id).toBe(id);
      expect(MACHINES[r.machine]).toBeDefined();
      for (const i of r.inputs) {
        if ("crop" in i) expect(CROPS[i.crop]).toBeDefined();
        else expect(PRODUCE_IDS).toContain(i.produce);
        expect(i.qty).toBeGreaterThan(0);
      }
      const ratio = r.price / inputValue(r);
      expect(ratio).toBeGreaterThanOrEqual(1.3);
      expect(ratio).toBeLessThanOrEqual(1.7);
    }
  });

  it("a starter-crop recipe exists, so a new farm can use the factory", () => {
    expect(RECIPES.pickles.inputs.every((i) => "crop" in i && CROPS[i.crop].rarity === "common")).toBe(true);
  });

  it("products are market items: parsed and priced with the stall bonus", () => {
    expect(parseItem("product:cheese")).toEqual({ kind: "product", id: "cheese" });
    expect(parseItem("product:nope")).toBeNull();
    expect(sellPrice("product:cheese", 0)).toBe(28);
    expect(sellPrice("product:cheese", 2)).toBe(Math.round(28 * 1.2));
  });
});

describe("queue rules", () => {
  it("speed upgrades shorten jobs; capacity upgrades hold more", () => {
    expect(jobMinutes(RECIPES.cheese, 0)).toBe(60);
    expect(jobMinutes(RECIPES.cheese, 1)).toBe(48);
    expect(jobMinutes(RECIPES.cheese, 2)).toBe(39);
    expect(jobMinutes(RECIPES.cheese, 9)).toBe(39);
    expect([0, 1, 2].map(capacity)).toEqual([2, 3, 4]);
  });

  it("one job at a time: a new job starts when the last one ends, or now", () => {
    expect(nextStart([], at(0)).toISOString()).toBe(iso(0));
    expect(nextStart([job("jam_jar", -30, -10)], at(0)).toISOString()).toBe(iso(0));
    expect(nextStart([job("jam_jar", -5, 15), job("jam_jar", 15, 35)], at(0)).toISOString()).toBe(iso(35));
  });

  it("states and progress follow the clock", () => {
    const j = job("jam_jar", 10, 30);
    expect(jobState(j, at(0))).toBe("waiting");
    expect(jobState(j, at(20))).toBe("running");
    expect(progress(j, at(20))).toBeCloseTo(0.5);
    expect(jobState(j, at(30))).toBe("ready");
    expect(progress(j, at(40))).toBe(1);
    expect(jobState({ ...j, collected_at: iso(31) }, at(40))).toBe("collected");
  });

  it("uncollected jobs (even finished ones) take room until collected", () => {
    const m = machine("jam_jar");
    const jobs = [job("jam_jar", -40, -20), job("jam_jar", -20, 10)];
    expect(hasRoom(m, jobs)).toBe(false);
    expect(hasRoom(m, [{ ...jobs[0], collected_at: iso(-19) }, jobs[1]])).toBe(true);
    expect(hasRoom({ ...m, capacity_level: 1 }, jobs)).toBe(true);
  });

  it("inputs: crops count at any quality; missing amounts are reported", () => {
    const stock = [
      { item_id: "crop:radish:normal:100", qty: 1 },
      { item_id: "crop:radish:gold:150", qty: 1 },
      { item_id: "crop:turnip", qty: 1 },
    ];
    expect(missingInputs(RECIPES.pickles, stock)).toEqual([
      { input: { crop: "turnip", qty: 2 }, missing: 1 },
    ]);
    expect(missingInputs(RECIPES.pickles, [...stock, { item_id: "crop:turnip:silver:100", qty: 1 }])).toEqual(
      [],
    );
    expect(missingInputs(RECIPES.butter, [{ item_id: "produce:milk", qty: 2 }])).toEqual([]);
    // A crop id that's a prefix of another doesn't count (crop:corn vs crop:corny).
    expect(missingInputs(RECIPES.cornbread, [{ item_id: "crop:cornx:normal:100", qty: 9 }])).toHaveLength(2);
  });
});

describe("KPI panel (throughput, utilization, WIP, bottleneck)", () => {
  const now = at(0);
  it("utilization is busy time over the time owned in the window; the busiest machine is the bottleneck", () => {
    const day = 24 * 60;
    const machines = [machine("jam_jar", -2 * day), machine("bakery", -2 * day)];
    const jobs = [
      // jam jar: 12 h busy in 2 days → 25%
      job("jam_jar", -2 * day, -2 * day + 720),
      // bakery: 24 h busy in 2 days → 50%, plus 1 still running
      job("bakery", -day * 1.5, -day * 0.5),
      job("bakery", -30, 30),
    ];
    const k = factoryKpi(machines, jobs, now);
    const util = Object.fromEntries(k.machines.map((m) => [m.machine, m.utilization]));
    expect(util.jam_jar).toBeCloseTo(0.25, 2);
    expect(util.bakery).toBeCloseTo((24 * 60 + 30) / (2 * day), 2);
    expect(k.bottleneck).toBe("bakery");
    expect(k.wip).toBe(1);
    expect(k.throughputPerDay).toBeCloseTo(2 / 2, 5);
    expect(k.readyToCollect).toBe(2);
  });

  it("lead time includes the wait in the queue; process time doesn't", () => {
    const jobs = [
      job("jam_jar", -60, -40, { created_at: iso(-90) }),
      job("jam_jar", -40, -20, { created_at: iso(-90) }),
    ];
    const k = factoryKpi([machine("jam_jar")], jobs, now);
    expect(k.processMin).toBe(20);
    expect(k.leadMin).toBe(60);
  });

  it("only the window counts; no work means no bottleneck", () => {
    const old = job("jam_jar", -60 * 24 * 10, -60 * 24 * 10 + 30);
    const k = factoryKpi([machine("jam_jar")], [old], now);
    expect(k.throughputPerDay).toBe(0);
    expect(k.machines[0].utilization).toBe(0);
    expect(k.bottleneck).toBeNull();
    expect(factoryKpi([], [], now)).toMatchObject({ wip: 0, bottleneck: null, leadMin: null, machines: [] });
  });

  it("a machine built seconds ago isn't shown as busy: at least an hour counts (no 74% after 3 s)", () => {
    const k = factoryKpi([machine("jam_jar", -0.05)], [job("jam_jar", -0.05, 20)], now);
    expect(k.machines[0].utilization).toBeLessThan(0.01);
    expect(k.bottleneck).toBe("jam_jar"); // it still has the work
  });

  it("a machine bought an hour ago isn't diluted by the whole week", () => {
    const k = factoryKpi([machine("loom", -60)], [job("loom", -60, -30)], now);
    expect(k.machines[0].utilization).toBeCloseTo(0.5, 5);
    expect(k.throughputPerDay).toBe(1);
  });
});

describe("which items a job takes (G7 R-M13-2: no silent use of a premium crop)", () => {
  it("lowest quality first, then the lower price, like the server", () => {
    const stock = [
      { item_id: "crop:radish:gold:100", qty: 5 },
      { item_id: "crop:radish:normal:300", qty: 1 },
      { item_id: "crop:radish:normal:100", qty: 1 },
      { item_id: "crop:turnip", qty: 2 },
    ];
    expect(wouldTake(RECIPES.pickles, stock)).toEqual([
      { item_id: "crop:radish:normal:100", qty: 1 },
      { item_id: "crop:radish:normal:300", qty: 1 },
      { item_id: "crop:turnip", qty: 2 },
    ]);
  });

  it("flags gold/silver/prismatic or a weather bonus; plain and animal goods are fine", () => {
    expect(
      takesPremium([
        { item_id: "crop:radish:normal:100", qty: 2 },
        { item_id: "crop:turnip", qty: 2 },
      ]),
    ).toBe(false);
    expect(takesPremium([{ item_id: "produce:milk", qty: 3 }])).toBe(false);
    expect(takesPremium([{ item_id: "crop:radish:gold:100", qty: 1 }])).toBe(true);
    expect(takesPremium([{ item_id: "crop:radish:normal:300", qty: 1 }])).toBe(true);
  });
});
