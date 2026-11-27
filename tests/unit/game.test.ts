import { describe, expect, it } from "vitest";
import { BLOCK_KEYS, type BlockKey } from "@/content/blocks";
import { CROPS, CROP_IDS, GACHA_CROP_IDS, GROW_DAYS, STARTER_CROPS } from "@/content/crops";
import { MUTATION_MULTIPLIER } from "@/content/game";
import {
  blockResult,
  buildDayFacts,
  dayOee,
  earnedMutations,
  farmState,
  findGiants,
  growthStage,
  isMinimumDay,
  isPerfectDay,
  mutationMultiplier,
  oneMissFromDeath,
  oneMissFromWeeds,
  farmDay,
  qualityOf,
  roll,
  simulatePlot,
  type DayFacts,
  type GameLog,
  type Planting,
} from "@/lib/game";

const T = (date: string, hm: string) => new Date(`${date}T${hm}:00+07:00`).toISOString();

/** A block that started on time with its first-10 done. */
function good(date: string, extra: Partial<GameLog> = {}): GameLog {
  return {
    planned_start: T(date, "09:00"),
    started_at: T(date, "09:05"),
    first10_at: T(date, "09:15"),
    items_done: [],
    items_planned: 0,
    location: "home",
    backfilled: false,
    planned_deviation: false,
    miss_reason: null,
    ...extra,
  };
}
const late = (date: string, extra: Partial<GameLog> = {}) =>
  good(date, { started_at: T(date, "09:30"), first10_at: null, ...extra });

function day(
  date: string,
  logs: Partial<Record<BlockKey, GameLog>>,
  extra: Partial<DayFacts> = {},
): DayFacts {
  return {
    date,
    mode: "normal",
    logs,
    wakeInWindow: false,
    nightRitualDone: false,
    exercised: false,
    ...extra,
  };
}
/** Every block good: a minimum + perfect day. */
function perfect(date: string, extra: Partial<DayFacts> = {}): DayFacts {
  const logs = Object.fromEntries(BLOCK_KEYS.map((b) => [b, good(date)])) as Record<BlockKey, GameLog>;
  return day(date, logs, { wakeInWindow: true, nightRitualDone: true, ...extra });
}
const plant = (slot: BlockKey, cropId: Planting["cropId"], plantedOn: string, star = 1): Planting => ({
  slot,
  cropId,
  star,
  plantedOn,
});

describe("crop catalog (SPEC §8.2)", () => {
  it("20 capsule crops, 4 per rarity, grow days by rarity, pumpkin + melon go giant, uncommon regrow", () => {
    expect(GACHA_CROP_IDS).toHaveLength(20);
    for (const r of Object.keys(GROW_DAYS) as (keyof typeof GROW_DAYS)[]) {
      const of = GACHA_CROP_IDS.filter((id) => CROPS[id].rarity === r);
      expect(of).toHaveLength(4);
      of.forEach((id) => expect(CROPS[id].growDays).toBe(GROW_DAYS[r]));
    }
    expect(GROW_DAYS).toEqual({ common: 1, uncommon: 2, rare: 3, epic: 5, legendary: 7 });
    expect(CROP_IDS.filter((id) => CROPS[id].giant)).toEqual(["pumpkin", "melon"]);
    expect(GACHA_CROP_IDS.filter((id) => CROPS[id].regrow)).toEqual([
      "strawberry",
      "blueberry",
      "tomato",
      "corn",
    ]);
    STARTER_CROPS.forEach((id) => expect(CROPS[id].rarity).toBe("common"));
  });
});

describe("block result (SPEC §8.1 success, §8.4 no-penalty cases)", () => {
  const d = "2026-11-10";
  const r = (log: GameLog | undefined, extra: Partial<DayFacts> = {}) =>
    blockResult(day(d, log ? { focus: log } : {}, extra), "focus");
  it("on-time start (±10 min) = success", () => {
    expect(r(good(d))).toBe("success");
    expect(r(good(d, { started_at: T(d, "08:50") }))).toBe("success");
  });
  it("late but checklist ≥ 70% = success; under 70% = partial", () => {
    expect(r(late(d, { items_planned: 10, items_done: Array(7).fill("x") }))).toBe("success");
    expect(r(late(d, { items_planned: 10, items_done: Array(6).fill("x") }))).toBe("partial");
    expect(r(late(d))).toBe("partial");
  });
  it("no check-in or a miss reason = miss", () => {
    expect(r(undefined)).toBe("miss");
    expect(r(good(d, { started_at: null, first10_at: null }))).toBe("miss");
    expect(r(late(d, { miss_reason: "phone" }))).toBe("miss");
  });
  it("Vacation/Sick and planned deviations = excused (no penalty)", () => {
    expect(r(undefined, { mode: "vacation" })).toBe("excused");
    expect(r(undefined, { mode: "sick" })).toBe("excused");
    expect(r(good(d, { planned_deviation: true, miss_reason: "other" }))).toBe("excused");
  });
  it("a backfill isn't a success (no on-time proof) but isn't a miss either", () => {
    expect(r(good(d, { backfilled: true }))).toBe("backfilled");
  });
  it("today's open block: a success already counts, nothing else does yet", () => {
    expect(r(undefined, { open: ["focus"] })).toBe("open");
    expect(r(late(d), { open: ["focus"] })).toBe("open");
    expect(r(good(d), { open: ["focus"] })).toBe("success");
  });
});

describe("Day OEE, minimum day, perfect day (SPEC §7, §8.7)", () => {
  const d = "2026-11-10";
  it("OEE = availability × performance × quality", () => {
    const logs: Partial<Record<BlockKey, GameLog>> = {};
    BLOCK_KEYS.forEach((b, i) => {
      logs[b] = i < 6 ? good(d) : late(d); // 6/7 on time, 6/7 first-10
    });
    logs.work = good(d, { items_planned: 4, items_done: ["a", "b", "c"] }); // 3/4 items
    const o = dayOee(day(d, logs))!;
    expect(o.availability).toBeCloseTo(6 / 7);
    expect(o.performance).toBeCloseTo(3 / 4);
    expect(o.quality).toBeCloseTo(6 / 7);
    expect(o.oee).toBeCloseTo((6 / 7) * (3 / 4) * (6 / 7));
  });
  it("planned deviations leave the denominator; blocks without a first-10 leave the quality rate", () => {
    const p = perfect(d);
    p.logs.free = late(d, { planned_deviation: true });
    p.logs.focus = late(d, { started_at: T(d, "09:00") }); // on time, no first-10 set
    const o = dayOee({ ...p, noFirst10: ["focus"] })!;
    expect(o.availability).toBe(1);
    expect(o.quality).toBe(1);
  });
  it("no OEE on Vacation/Sick days; nothing planned → performance 1", () => {
    expect(dayOee(day(d, {}, { mode: "sick" }))).toBeNull();
    expect(dayOee(perfect(d))!.performance).toBe(1);
  });
  it("minimum day = in-window wake + Night ritual; perfect = minimum + OEE ≥ 80%", () => {
    expect(isMinimumDay(perfect(d))).toBe(true);
    expect(isMinimumDay(perfect(d, { nightRitualDone: false }))).toBe(false);
    expect(isPerfectDay(perfect(d))).toBe(true);
    const p = perfect(d);
    p.logs.work = late(d);
    p.logs.focus = late(d); // 5/7 × 5/7 ≈ 51%
    expect(isPerfectDay(p)).toBe(false);
  });
});

describe("mutations (SPEC §8.3)", () => {
  const d = "2026-11-10";
  it("each behavior earns its mutation", () => {
    expect(earnedMutations(day(d, {}, { wakeInWindow: true }))).toEqual(["sunrise_glow"]);
    expect(earnedMutations(day(d, { wake: good(d) }))).toEqual(["dew"]);
    expect(earnedMutations(day(d, { down: good(d) }))).toEqual(["moonlit"]);
    expect(earnedMutations(day(d, { down: late(d, { first10_at: T(d, "09:40") }) }))).toEqual([]);
    expect(earnedMutations(day(d, { work: late(d, { location: "out" }) }))).toEqual(["breeze"]);
    expect(earnedMutations(day(d, {}, { exercised: true }))).toEqual(["spark"]);
    expect(earnedMutations(perfect(d))).toEqual(["sunrise_glow", "dew", "moonlit", "rainbow"]);
  });
  it("backfills and Vacation/Sick days earn nothing", () => {
    expect(earnedMutations(day(d, { wake: good(d, { backfilled: true }) }))).toEqual([]);
    expect(earnedMutations(perfect(d, { mode: "vacation" }))).toEqual([]);
  });
  it("they stack multiplicatively, each once", () => {
    expect(mutationMultiplier([])).toBe(1);
    expect(mutationMultiplier(["sunrise_glow", "dew"])).toBe(3);
    expect(mutationMultiplier(["rainbow", "rainbow"])).toBe(5);
    expect(mutationMultiplier(["sunrise_glow", "dew", "moonlit", "breeze", "spark", "rainbow"])).toBe(
      Object.values(MUTATION_MULTIPLIER).reduce((a, b) => a * b, 1),
    );
  });
});

describe("quality (SPEC §8.2)", () => {
  it("from the first-10 rate and checklist %, stars help, wilt steps down", () => {
    expect(qualityOf({ days: 2, first10Days: 2, checklistRates: [] })).toBe("prismatic");
    expect(qualityOf({ days: 2, first10Days: 2, checklistRates: [0.5, 0.5] })).toBe("gold"); // 0.75
    expect(qualityOf({ days: 2, first10Days: 1, checklistRates: [] })).toBe("silver");
    expect(qualityOf({ days: 3, first10Days: 1, checklistRates: [] })).toBe("normal");
    expect(qualityOf({ days: 2, first10Days: 1, checklistRates: [] }, 5)).toBe("gold"); // 0.5 + 0.2
    expect(qualityOf({ days: 2, first10Days: 2, checklistRates: [] }, 1, 1)).toBe("gold");
    expect(qualityOf({ days: 2, first10Days: 0, checklistRates: [] }, 1, 2)).toBe("normal");
  });
});

describe("growth + penalties (SPEC §8.1, §8.4)", () => {
  it("a common seed planted at night is ready after one successful block the next day", () => {
    const p = plant("focus", "radish", "2026-11-09");
    const v = simulatePlot(p, [perfect("2026-11-09"), perfect("2026-11-10")]);
    expect(v).toMatchObject({
      status: "ready",
      growthDays: 1,
      stage: 3,
      quality: "prismatic",
      readyOn: "2026-11-10",
    });
  });
  it("growth counts success days only; stages follow progress", () => {
    const p = plant("focus", "dragon_fruit", "2026-11-09"); // 5 days
    const days = [
      perfect("2026-11-10"),
      day("2026-11-11", { focus: late("2026-11-11") }), // partial
      perfect("2026-11-12"),
    ];
    const v = simulatePlot(p, days);
    expect(v).toMatchObject({ status: "growing", growthDays: 2, stage: 1, weeds: false });
    expect(growthStage(0, 5, "growing")).toBe(0);
    expect(growthStage(3, 5, "growing")).toBe(2);
  });
  // Rule A (Minnie OK 2026-11-27): damage comes from missed days (an active day with neither an
  // in-window "I'm up" nor the Night ritual), never from a skipped block.
  /** An active day with no anchor: a block checked in live, but no live wake in the window or ritual. */
  const drift = (date: string, logs: Partial<Record<BlockKey, GameLog>> = {}) =>
    day(date, { gradation: late(date), ...logs });
  /** A kept day: the wake anchor only (no ritual), nothing else logged. */
  const anchored = (date: string, logs: Partial<Record<BlockKey, GameLog>> = {}) =>
    day(date, logs, { wakeInWindow: true });
  it("a skipped block on a kept day only skips growth: no weeds, no streak", () => {
    const p = plant("focus", "dragon_fruit", "2026-11-09");
    const skipped = (date: string) => perfect(date, { logs: { ...perfect(date).logs, focus: undefined } });
    const tagged = (date: string) =>
      perfect(date, {
        logs: { ...perfect(date).logs, focus: late(date, { started_at: null, miss_reason: "phone" }) },
      });
    const v = simulatePlot(p, [perfect("2026-11-10"), skipped("2026-11-11"), tagged("2026-11-12")]);
    expect(v).toMatchObject({ growthDays: 1, weeds: false, missStreak: 0, wiltLevel: 0 });
    // One anchor is enough to keep the day: the wake alone, or the ritual alone.
    const w = simulatePlot(p, [anchored("2026-11-10"), day("2026-11-11", {}, { nightRitualDone: true })]);
    expect(w).toMatchObject({ weeds: false, missStreak: 0 });
  });
  it("never miss twice: the 1st missed day is a warning, the 2nd brings weeds, a kept day clears them", () => {
    const p = plant("focus", "dragon_fruit", "2026-11-09");
    let v = simulatePlot(p, [perfect("2026-11-10"), drift("2026-11-11")]);
    expect(v).toMatchObject({ growthDays: 1, weeds: false, missStreak: 1 });
    expect(oneMissFromWeeds(v)).toBe(true);
    // A good block on a missed day still grows (blocks only help); the day's health comes after.
    v = simulatePlot(p, [
      perfect("2026-11-10"),
      drift("2026-11-11"),
      drift("2026-11-12", { focus: good("2026-11-12") }),
    ]);
    expect(v).toMatchObject({ growthDays: 2, weeds: true, missStreak: 2 });
    expect(oneMissFromWeeds(v)).toBe(false);
    // Weedy: the next kept day's success doesn't grow, and the weeds clear at its end.
    const kept = perfect("2026-11-13");
    v = simulatePlot(p, [perfect("2026-11-10"), drift("2026-11-11"), drift("2026-11-12"), kept]);
    expect(v).toMatchObject({ growthDays: 1, weeds: false, missStreak: 0 });
    v = simulatePlot(p, [
      perfect("2026-11-10"),
      drift("2026-11-11"),
      drift("2026-11-12"),
      kept,
      perfect("2026-11-14"),
    ]);
    expect(v).toMatchObject({ growthDays: 2, weeds: false });
  });
  it("3 missed days in a row → wilt (−1 quality); 5 → dead", () => {
    const p = plant("work", "coffee", "2026-11-09");
    const three = simulatePlot(p, [drift("2026-11-10"), drift("2026-11-11"), drift("2026-11-12")]);
    expect(three).toMatchObject({ wiltLevel: 1, status: "growing", missStreak: 3, weeds: true });
    const five = simulatePlot(
      p,
      ["10", "11", "12", "13", "14"].map((x) => drift(`2026-11-${x}`)),
    );
    expect(five).toMatchObject({ status: "dead", missStreak: 5 });
    // Nothing brings a dead crop back.
    expect(
      simulatePlot(p, [
        ...["10", "11", "12", "13", "14"].map((x) => drift(`2026-11-${x}`)),
        perfect("2026-11-15"),
      ]).status,
    ).toBe("dead");
  });
  it("Vacation/Sick, away days and quiet days pause the run (no penalty, no reset)", () => {
    const p = plant("work", "coffee", "2026-11-09");
    const v = simulatePlot(p, [
      drift("2026-11-10"),
      drift("2026-11-11"),
      day("2026-11-12", {}, { mode: "sick" }),
      day("2026-11-13", {}, { away: true }),
      drift("2026-11-14"),
    ]);
    expect(v).toMatchObject({ missStreak: 3, wiltLevel: 1, status: "growing" });
  });
  it("logging a bad day never makes it worse: a backfill or an honest miss reason alone is a quiet day (G7 A S2-2)", () => {
    const p = plant("work", "coffee", "2026-11-09");
    const backfill = day("2026-11-11", { work: good("2026-11-11", { backfilled: true }) });
    const honest = day("2026-11-12", {
      focus: late("2026-11-12", { started_at: null, first10_at: null, miss_reason: "phone" }),
    });
    expect(farmDay(backfill)).toBe("paused");
    expect(farmDay(honest)).toBe("paused");
    expect(farmDay(drift("2026-11-13"))).toBe("missed");
    expect(simulatePlot(p, [drift("2026-11-10"), backfill, honest])).toMatchObject({
      missStreak: 1,
      weeds: false,
    });
  });
  it("a planned late night doesn't pause the farm: an on-time I'm up keeps the day, an oversleep doesn't (G7 A S2-1)", () => {
    expect(farmDay(day("2026-11-11", {}, { excused: ["free"], wakeInWindow: true }))).toBe("kept");
    expect(farmDay(drift("2026-11-11", {}))).toBe("missed");
    expect(farmDay({ ...drift("2026-11-11"), excused: ["free"] })).toBe("missed");
  });
  it("only a kept day ends the run: a late start or a backfill on a missed day doesn't", () => {
    const p = plant("work", "coffee", "2026-11-09");
    const v = simulatePlot(p, [
      drift("2026-11-10"),
      drift("2026-11-11", { work: late("2026-11-11") }),
      drift("2026-11-12", { work: good("2026-11-12", { backfilled: true }) }),
      anchored("2026-11-13"),
      drift("2026-11-14"),
    ]);
    expect(v).toMatchObject({ missStreak: 1, wiltLevel: 1, growthDays: 0, weeds: false });
  });
  it("today never counts as missed while it's open", () => {
    const p = plant("work", "coffee", "2026-11-09");
    const v = simulatePlot(p, [drift("2026-11-10"), day("2026-11-11", {}, { open: [...BLOCK_KEYS] })]);
    expect(v).toMatchObject({ missStreak: 1, weeds: false });
  });
  it("the planting day itself doesn't count; a regrowing crop restarts after its harvest", () => {
    const p = plant("focus", "strawberry", "2026-11-10");
    expect(simulatePlot(p, [perfect("2026-11-10")]).growthDays).toBe(0);
    const v = simulatePlot({ ...p, harvestedOn: "2026-11-12" }, [
      perfect("2026-11-11"),
      perfect("2026-11-12"),
      perfect("2026-11-13"),
    ]);
    expect(v).toMatchObject({ growthDays: 1, status: "growing" });
  });
  it("a ready crop waits: later misses don't hurt it", () => {
    const p = plant("focus", "radish", "2026-11-09");
    const v = simulatePlot(p, [perfect("2026-11-10"), day("2026-11-11", {}), day("2026-11-12", {})]);
    expect(v).toMatchObject({ status: "ready", weeds: false, wiltLevel: 0 });
  });
  it("crops pick up the weather the previous day earned, on the days they grow", () => {
    const p = plant("focus", "sunflower", "2026-11-09"); // 3 days
    const v = simulatePlot(p, [
      day("2026-11-09", {}, { exercised: true }), // → spark on the 10th
      day("2026-11-10", { focus: good("2026-11-10") }, { wakeInWindow: true }), // grows w/ spark; → glow on the 11th
      day("2026-11-11", { focus: late("2026-11-11") }), // partial: no growth, glow not picked up
      day("2026-11-12", { focus: good("2026-11-12") }), // grows; 11th earned nothing
    ]);
    expect(v.mutations).toEqual(["spark"]);
    expect(v.multiplier).toBe(2);
  });
  it("a gap in the data means no weather", () => {
    const p = plant("focus", "radish", "2026-11-09");
    const v = simulatePlot(p, [day("2026-11-08", {}, { exercised: true }), perfect("2026-11-10")]);
    expect(v.mutations).toEqual([]);
  });
});

describe("a seeded week produces the right farm (M6 done-when)", () => {
  // Mon 9 Nov → Sun 15 Nov 2026. Plant the evening of Sun 8.
  const plantings: Planting[] = [
    plant("wake", "radish", "2026-11-08"),
    plant("focus", "pumpkin", "2026-11-08"),
    plant("work", "pumpkin", "2026-11-08"),
    plant("gradation", "pumpkin", "2026-11-08"),
    plant("free", "lettuce", "2026-11-08"),
    plant("down", "grape", "2026-11-08"),
    plant("sleep", "tomato", "2026-11-08"),
  ];
  const week = (): DayFacts[] => {
    const ds = ["09", "10", "11", "12", "13", "14", "15"].map((x) => `2026-11-${x}`);
    return ds.map((d, i) => {
      const p = perfect(d, { exercised: i % 2 === 0 });
      if (i === 1) p.logs.free = undefined; // Tue: free missed (lettuce was ready Mon: safe)
      // Wed–Sat: down skipped (Thu is excused). Tagged with a reason in the ritual: the ritual
      // itself would otherwise credit Down Time (playtest R1 R1).
      if (i >= 2 && i <= 5)
        p.logs.down = late(d, { started_at: null, first10_at: null, miss_reason: "phone" });
      if (i === 3) p.mode = "sick"; // Thu sick: excused, streak paused
      return p;
    });
  };
  const f = farmState(plantings, week(), "user-1");
  it("plot states", () => {
    expect(f.plots.wake).toMatchObject({ status: "ready", readyOn: "2026-11-09", quality: "prismatic" });
    expect(f.plots.free).toMatchObject({ status: "ready", weeds: false });
    expect(f.plots.sleep).toMatchObject({ status: "ready", growthDays: 2 });
    // Grape (5 days): grew Mon, Tue; Down skipped Wed, Fri, Sat (Thu sick) but every day was kept
    // (minimum days), so a skipped block only skips growth (rule A); grew again Sun → 3.
    expect(f.plots.down).toMatchObject({
      status: "growing",
      growthDays: 3,
      wiltLevel: 0,
      missStreak: 0,
      weeds: false,
    });
    expect(f.plots.down!.quality).toBe("prismatic");
    expect(f.plots.focus).toMatchObject({ status: "ready", readyOn: "2026-11-11" });
  });
  it("three ready pumpkins in a row can merge into a giant (seeded, repeatable)", () => {
    expect(f.giants.every((g) => g.cropId === "pumpkin" && g.slots.join() === "focus,work,gradation")).toBe(
      true,
    );
    const again = farmState(plantings, week(), "user-1");
    expect(again.giants).toEqual(f.giants);
    // Some seed merges and the merge day is after all three were ready.
    const seeds = Array.from({ length: 20 }, (_, i) => `u${i}`);
    const merged = seeds.map((s) => farmState(plantings, week(), s).giants).filter((g) => g.length > 0);
    expect(merged.length).toBeGreaterThan(0);
    merged.forEach((g) => expect(g[0]!.on > "2026-11-11").toBe(true));
  });
  it("today's weather = what yesterday earned", () => {
    // Sat 14: in-window wake + wake first-10; down skipped (no moonlit; OEE 6/7 × 6/7 < 80%, so
    // no rainbow); not exercised.
    expect(f.weather).toEqual(["sunrise_glow", "dew"]);
  });
  it("no giant from mixed crops or plots that aren't ready", () => {
    const mixed = plantings.map((p) => (p.slot === "work" ? { ...p, cropId: "melon" as const } : p));
    expect(farmState(mixed, week(), "user-1").giants).toEqual([]);
    const short = week().slice(0, 2); // pumpkins not ready yet
    expect(findGiants(farmState(plantings, short, "x").plots, short, "x")).toEqual([]);
  });
  it("roll is deterministic and in [0, 1)", () => {
    expect(roll("a")).toBe(roll("a"));
    for (const k of ["", "a", "b", "user-1:2026-11-12:focus,work,gradation"]) {
      expect(roll(k)).toBeGreaterThanOrEqual(0);
      expect(roll(k)).toBeLessThan(1);
    }
  });
});

describe("day facts from rows (lib/game/facts)", () => {
  const log = (date: string, block: BlockKey) => ({ ...good(date), date, block });
  it("one day per wake-day; only live in-window wakes and Night tickets count; today is open", () => {
    const f = buildDayFacts({
      from: "2026-11-08",
      today: "2026-11-10",
      timezone: "Asia/Bangkok",
      logs: [log("2026-11-09", "focus"), log("2026-11-10", "wake")],
      modes: { "2026-11-08": "sick" },
      wakes: [
        { date: "2026-11-09", in_window: true, backfilled: false },
        { date: "2026-11-08", in_window: true, backfilled: true },
      ],
      nights: ["2026-11-09"],
      exercise: ["2026-11-09T18:30:00Z"], // 01:30 on the 10th in Bangkok
    });
    expect(f.map((d) => d.date)).toEqual(["2026-11-08", "2026-11-09", "2026-11-10"]);
    expect(f[0]).toMatchObject({ mode: "sick", wakeInWindow: false });
    expect(f[0]!.open).toBeUndefined();
    expect(f[1]).toMatchObject({
      mode: "normal",
      wakeInWindow: true,
      nightRitualDone: true,
      exercised: false,
    });
    expect(Object.keys(f[1]!.logs)).toEqual(["focus"]);
    expect(f[2]).toMatchObject({ exercised: true, open: [...BLOCK_KEYS] });
    expect(isMinimumDay(f[1]!)).toBe(true);
  });
});

describe("a planned late night is a planned deviation (SPEC §3, §8.4; G7 R-M6-2)", () => {
  it("out late before D excuses D−1's Free: no miss, no weeds — a success still grows", () => {
    const p = plant("free", "sunflower", "2026-11-09"); // 3 days
    const d10 = day("2026-11-10", { free: good("2026-11-10") }, { wakeInWindow: true });
    const d11 = day("2026-11-11", {}, { excused: ["free"] }); // out late on the night of the 11th
    const d12 = day("2026-11-12", { free: good("2026-11-12") }, { wakeInWindow: true });
    expect(blockResult(d11, "free")).toBe("excused");
    expect(simulatePlot(p, [d10, d11, d12])).toMatchObject({ growthDays: 2, weeds: false, missStreak: 0 });
    expect(blockResult(day("2026-11-11", { free: good("2026-11-11") }, { excused: ["free"] }), "free")).toBe(
      "success",
    );
  });
  it("buildDayFacts turns day_plans.late_night on D into an excused Free on D−1", () => {
    const f = buildDayFacts({
      from: "2026-11-10",
      today: "2026-11-12",
      timezone: "Asia/Bangkok",
      logs: [],
      modes: {},
      lateNights: ["2026-11-12"],
      wakes: [],
      nights: [],
      exercise: [],
    });
    expect(f.map((d) => d.excused ?? [])).toEqual([[], ["free"], []]);
  });
});

describe("lived actions are credited (playtest R1 R1, Minnie OK 2026-11-11)", () => {
  const d = "2026-11-10";
  it("an in-window 'I'm up' is Wake's success; the Night ritual in time is Down's", () => {
    const f = day(d, {}, { wakeInWindow: true, nightRitualDone: true });
    expect(blockResult(f, "wake")).toBe("success");
    expect(blockResult(f, "down")).toBe("success");
    // Without them, untouched blocks are missed as before.
    const none = day(d, {});
    expect(blockResult(none, "wake")).toBe("miss");
    expect(blockResult(none, "down")).toBe("miss");
    // A Sick/Vacation day stays excused.
    expect(blockResult(day(d, {}, { mode: "sick", wakeInWindow: true }), "wake")).toBe("excused");
  });
  it("Day score counts them as on-time starts", () => {
    const o = dayOee(day(d, {}, { wakeInWindow: true, nightRitualDone: true }))!;
    expect(o.availability).toBeCloseTo(2 / 7);
  });
});

describe("away days pause the farm (playtest R1 R2, Minnie OK 2026-11-11)", () => {
  const empty = { logs: [], modes: {}, wakes: [], nights: [], exercise: [] };
  it("a finished day with nothing logged at all is away; any wake, log, ritual or workout isn't; today never is", () => {
    const f = buildDayFacts({
      ...empty,
      from: "2026-11-05",
      today: "2026-11-10",
      timezone: "Asia/Bangkok",
      logs: [{ ...good("2026-11-06"), date: "2026-11-06", block: "focus" }],
      wakes: [{ date: "2026-11-07", in_window: false, backfilled: true }],
      nights: ["2026-11-08"],
      exercise: ["2026-11-09T05:00:00Z"],
    });
    expect(f.map((d) => Boolean(d.away))).toEqual([true, false, false, false, false, false]);
    const g = buildDayFacts({ ...empty, from: "2026-11-09", today: "2026-11-10", timezone: "Asia/Bangkok" });
    expect(g.map((d) => Boolean(d.away))).toEqual([true, false]);
  });
  it("an away day excuses every block: no weeds, no wilt, no death, no Day score", () => {
    const a = day("2026-11-10", {}, { away: true });
    for (const b of BLOCK_KEYS) expect(blockResult(a, b)).toBe("excused");
    expect(dayOee(a)).toBeNull();
    const p = plant("focus", "sunflower", "2026-11-01");
    const days = ["02", "03", "04", "05", "06", "07", "08"].map((dd) =>
      day(`2026-11-${dd}`, {}, { away: true }),
    );
    expect(simulatePlot(p, days)).toMatchObject({
      status: "growing",
      weeds: false,
      wiltLevel: 0,
      missStreak: 0,
    });
  });
  it("the plot warns one miss before it dies", () => {
    const p = plant("focus", "sunflower", "2026-11-01");
    const misses = (n: number) =>
      Array.from({ length: n }, (_, i) => {
        const d = `2026-11-0${i + 2}`;
        return day(d, { work: late(d) }); // checked in live, no anchor
      });
    expect(oneMissFromDeath(simulatePlot(p, misses(3)))).toBe(false);
    expect(oneMissFromDeath(simulatePlot(p, misses(4)))).toBe(true);
    expect(oneMissFromDeath(simulatePlot(p, misses(5)))).toBe(false); // already dead
  });
});

describe("a first-10 done during the block counts as its start (playtest R1 R1, G7 F2)", () => {
  const d = "2026-11-10";
  it("late start but the first-10 was done live inside the block: success, and on time in Day score", () => {
    const log = good(d, { started_at: T(d, "13:30"), first10_at: T(d, "13:30") }); // planned 09:00
    expect(blockResult(day(d, { work: log }), "work")).toBe("success");
    expect(dayOee(day(d, { work: log }))!.availability).toBeCloseTo(1 / 7, 6);
  });
  it("a backfilled first-10, or one before the block, doesn't count", () => {
    expect(
      blockResult(day(d, { work: late(d, { first10_at: T(d, "13:30"), backfilled: true }) }), "work"),
    ).toBe("backfilled");
    expect(blockResult(day(d, { work: late(d, { first10_at: T(d, "08:30") }) }), "work")).toBe("partial");
  });
});
