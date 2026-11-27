import type { BlockKey } from "@/content/blocks";
import { CROPS, type CropId } from "@/content/crops";
import {
  DEAD_AT_MISSES,
  WEEDS_AT_MISSES,
  WILT_AT_MISSES,
  type MutationId,
  type Quality,
} from "@/content/game";
import { mutationMultiplier, earnedMutations } from "./mutations";
import { blockResult, checklistRate, farmDay, first10Done, type DayFacts } from "./outcome";
import { qualityOf, type GrowthRecord } from "./quality";

/** A seed in a block plot (the plots row: crop, star, when it was planted / last harvested). */
export type Planting = {
  slot: BlockKey;
  cropId: CropId;
  star: number;
  /** Local date it was planted (the Night ritual plans tomorrow): growth counts from the next day. */
  plantedOn: string;
  /** A regrowing crop counts again from the day after its last harvest. */
  harvestedOn?: string | null;
};

export type PlotStatus = "growing" | "ready" | "dead";

export type PlotView = {
  slot: BlockKey;
  cropId: CropId;
  star: number;
  status: PlotStatus;
  /** The wake-day it became ready (null while growing / dead). */
  readyOn: string | null;
  growthDays: number;
  growDays: number;
  /** Art stage: 0 seed · 1 sprout · 2 growing · 3 ready (dead uses its own art). */
  stage: 0 | 1 | 2 | 3;
  weeds: boolean;
  wiltLevel: number;
  /** Missed days in a row right now (1 → warning, 2 → weeds, 3 → wilt, 5 → dead). */
  missStreak: number;
  quality: Quality;
  mutations: MutationId[];
  multiplier: number;
  record: GrowthRecord;
};

export function growthStage(growthDays: number, growDays: number, status: PlotStatus): 0 | 1 | 2 | 3 {
  if (status === "ready") return 3;
  if (growthDays <= 0) return 0;
  return growthDays / growDays < 0.5 ? 1 : 2;
}

/**
 * Plays a planting forward over the days after it was planted (SPEC §8.1, §8.4).
 * `days` = wake-days in date order (finished days, plus today with its `open` blocks).
 *
 * - the block's success → +1 growth day (unless weeds are pausing it); for a block that isn't
 *   tracked (rule B), every kept day counts instead. Picks up that day's
 *   weather (the mutations the previous day earned). Any other block result just doesn't grow.
 * - the day's health (rule A, `farmDay`): a missed day in a row 1 → a warning only; 2 → weeds
 *   (the crop pauses); every 3rd → wilt (−1 quality); 5 → dead
 * - a kept day (an in-window "I'm up" or the Night ritual) ends the run and clears the weeds at
 *   its end; paused days (Vacation/Sick, away, a planned late night) and today change nothing
 * - a ready crop waits for harvest: nothing changes it any more
 */
export function simulatePlot(p: Planting, days: readonly DayFacts[]): PlotView {
  const crop = CROPS[p.cropId];
  const from = p.harvestedOn && p.harvestedOn > p.plantedOn ? p.harvestedOn : p.plantedOn;
  const record: GrowthRecord = { days: 0, first10Days: 0, checklistRates: [] };
  const mutations = new Set<MutationId>();
  let status: PlotStatus = "growing";
  let readyOn: string | null = null;
  let growthDays = 0;
  let weeds = false;
  let wiltLevel = 0;
  let missStreak = 0;
  let weather: MutationId[] = [];
  let prevDate: string | null = null;

  for (const day of days) {
    // Weather = what the previous calendar day earned (a gap in the data = no weather).
    if (prevDate === null || !isNextDay(prevDate, day.date)) weather = [];
    const todayWeather = weather;
    weather = earnedMutations(day);
    prevDate = day.date;

    if (day.date <= from || status !== "growing") continue;
    // An untracked block's plot (rule B) grows on every kept day instead: the farm stays alive for
    // someone tracking only the anchors, at normal quality (no first-10 or checklist to show).
    const grows =
      blockResult(day, p.slot) === "success" ||
      (!!day.untracked?.includes(p.slot) && farmDay(day) === "kept");
    if (grows && !weeds) {
      growthDays++;
      // A credited block (an in-window "I'm up", the Night ritual) may have no log of its own.
      const log = day.logs[p.slot];
      record.days++;
      if (log && first10Done(log)) record.first10Days++;
      const rate = log ? checklistRate(log) : null;
      if (rate !== null) record.checklistRates.push(rate);
      for (const m of todayWeather) mutations.add(m);
      if (growthDays >= crop.growDays) {
        status = "ready";
        readyOn = day.date;
        continue; // a ready crop waits: this day's health no longer touches it
      }
    }
    const health = farmDay(day);
    if (health === "missed") {
      missStreak++;
      if (missStreak >= WEEDS_AT_MISSES) weeds = true;
      if (missStreak % WILT_AT_MISSES === 0) wiltLevel++;
      if (missStreak >= DEAD_AT_MISSES) status = "dead";
    } else if (health === "kept") {
      missStreak = 0;
      weeds = false;
    }
  }

  const ms = [...mutations];
  return {
    slot: p.slot,
    cropId: p.cropId,
    star: p.star,
    status,
    readyOn,
    growthDays,
    growDays: crop.growDays,
    stage: growthStage(growthDays, crop.growDays, status),
    weeds,
    wiltLevel,
    missStreak,
    quality: qualityOf(record, p.star, wiltLevel),
    mutations: ms,
    multiplier: mutationMultiplier(ms),
    record,
  };
}

function isNextDay(a: string, b: string): boolean {
  const da = Date.parse(`${a}T00:00:00Z`);
  const db = Date.parse(`${b}T00:00:00Z`);
  return db - da === 86_400_000;
}

/** A growing plot one more missed day away from dying: the farm says so before it happens (R1 R2). */
export function oneMissFromDeath(v: Pick<PlotView, "status" | "missStreak">): boolean {
  return v.status === "growing" && v.missStreak === DEAD_AT_MISSES - 1;
}

/** The first missed day of a run: nothing happened yet, but one more brings weeds (rule A). */
export function oneMissFromWeeds(v: Pick<PlotView, "status" | "missStreak" | "weeds">): boolean {
  return v.status === "growing" && !v.weeds && v.missStreak === WEEDS_AT_MISSES - 1;
}
