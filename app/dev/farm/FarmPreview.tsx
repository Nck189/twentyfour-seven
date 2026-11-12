"use client";

import { useSearchParams } from "next/navigation";
import { FarmView } from "@/components/farm/FarmScreen";
import { ExerciseCard } from "@/components/exercise/ExerciseCard";
import { BLOCK_KEYS, type BlockKey } from "@/content/blocks";
import type { SkyPhase } from "@/lib/farm/sky";
import { farmState, type DayFacts, type GameLog, type Planting } from "@/lib/game";
import type { CropId } from "@/content/crops";
import type { GachaState, PullResult } from "@/lib/farm/useGacha";
import { addDays } from "@/lib/time";
import type { AnimalsState } from "@/lib/animals/useAnimals";
import type { AnimalId } from "@/content/animals";

const TODAY = "2026-11-15";
const at = (d: string, hm: string) => new Date(`${d}T${hm}:00+07:00`).toISOString();
const good = (d: string): GameLog => ({
  planned_start: at(d, "09:00"),
  started_at: at(d, "09:04"),
  first10_at: at(d, "09:12"),
  items_done: [],
  items_planned: 0,
  location: "home",
  backfilled: false,
  planned_deviation: false,
  miss_reason: null,
});

/** A week with a bit of everything: ripe, growing, weeds, wilt, dead, weather. */
function sampleDays(): DayFacts[] {
  return Array.from({ length: 8 }, (_, i) => {
    const date = addDays(TODAY, i - 7);
    const logs: Partial<Record<BlockKey, GameLog>> = {};
    for (const b of BLOCK_KEYS) logs[b] = good(date);
    if (i >= 3) delete logs.free; // free: misses → weeds → wilt → dead
    if (i === 6) delete logs.gradation; // gradation: a fresh miss → weeds
    if (i >= 4 && i <= 6) delete logs.down; // down: 3 misses → wilt
    return {
      date,
      mode: "normal",
      logs,
      wakeInWindow: i !== 6,
      nightRitualDone: i < 6,
      exercised: i % 2 === 0,
      ...(i === 7 ? { open: [...BLOCK_KEYS] } : {}),
    };
  });
}

const PLANTINGS: Planting[] = [
  { slot: "wake", cropId: "tomato", star: 1, plantedOn: addDays(TODAY, -7) },
  { slot: "focus", cropId: "pumpkin", star: 3, plantedOn: addDays(TODAY, -7) },
  { slot: "work", cropId: "sunflower", star: 1, plantedOn: addDays(TODAY, -2) },
  { slot: "gradation", cropId: "dragon_fruit", star: 1, plantedOn: addDays(TODAY, -6) },
  { slot: "down", cropId: "lavender", star: 1, plantedOn: addDays(TODAY, -7) },
  { slot: "free", cropId: "carrot", star: 1, plantedOn: addDays(TODAY, -4) },
];

const SKIES: SkyPhase[] = ["day", "sunrise", "dusk", "night"];

const SAMPLE_GACHA = {
  state: {
    tickets: 23,
    pity: { since_rare: 4, since_epic: 17, since_legendary: 52 },
    shards: { tomato: 7, radish: 3 } as Partial<Record<CropId, number>>,
    dex: Object.fromEntries(
      (["radish", "carrot", "tomato", "strawberry", "pumpkin", "lavender", "star_fruit"] as CropId[]).map(
        (c, i) => [c, { crop: c, count: 1 + (i % 3), star: 1 + (i % 2) }],
      ),
    ) as GachaState["dex"],
    seeds: { pumpkin: 1, star_fruit: 1, tomato: 2 } as Partial<Record<CropId, number>>,
    harvested: true,
  },
  pull: async (n: 1 | 10): Promise<PullResult[]> =>
    n === 1
      ? [{ crop: "moon_melon", rarity: "legendary", new: true, shards: 0 }]
      : (
          [
            ["radish", "common", false, 1],
            ["lettuce", "common", true, 0],
            ["corn", "uncommon", true, 0],
            ["carrot", "common", false, 1],
            ["blueberry", "uncommon", true, 0],
            ["sunflower", "rare", true, 0],
            ["turnip", "common", true, 0],
            ["tomato", "uncommon", false, 2],
            ["grape", "epic", true, 0],
            ["radish", "common", false, 1],
          ] as const
        ).map(([crop, rarity, isNew, shards]) => ({ crop, rarity, new: isNew, shards })),
  starUp: async () => true,
  reload: () => {},
};

const H = 3_600_000;
function sampleAnimals() {
  const now = Date.now();
  const mk = (species: AnimalId, fedH: number, love: number, producedH: number | null) => ({
    id: species,
    species,
    love,
    fedUntil: new Date(now + fedH * H),
    lastProduced: producedH === null ? null : new Date(now - producedH * H),
    createdAt: new Date(now - 72 * H),
  });
  const state: AnimalsState = {
    animals: [
      mk("chicken", 40, 64, null),
      mk("cow", 20, 22, 30),
      mk("capybara", 60, 90, 2),
      mk("sheep", -5, 10, 40),
      mk("red_panda", 30, 41, 3),
    ],
    eggProgress: 2,
    feed: 2,
    week: [
      { at: new Date(now - 30 * H).toISOString(), type: "gym", minutes: 45, counted: true },
      { at: new Date(now - 6 * H).toISOString(), type: "walk", minutes: 30, counted: true },
    ],
    weeklyGoal: 3,
    gymClose: "22:00",
    timezone: "Asia/Bangkok",
  };
  return {
    state,
    status: "ready" as const,
    reload: () => {},
    logExercise: async () => ({
      counted: true,
      eggProgress: 0,
      hatched: { id: "x", species: "alpaca" as AnimalId, rarity: "epic" as const },
    }),
    pet: async () => true,
    collect: async () => "milk" as const,
    feed: async () => true,
  };
}

export function FarmPreview() {
  const q = useSearchParams().get("sky");
  const sky = SKIES.find((s) => s === q) ?? "day";
  const farm = farmState(PLANTINGS, sampleDays(), "preview");
  const planted = new Set(PLANTINGS.map((p) => p.slot));
  const animals = sampleAnimals();
  return (
    <div className="mx-auto max-w-3xl py-2">
      <ExerciseCard animals={animals as never} />
      <FarmView
        data={{
          farm,
          sky,
          today: TODAY,
          house: 2,
          stall: 0,
          empty: BLOCK_KEYS.filter((b) => !planted.has(b)),
          coins: 120,
          decor: ["fence", "fence", "flowers"],
        }}
        status="ready"
        plant={async () => true}
        harvest={async () => "crop:radish:normal:100"}
        buyDecor={async () => true}
        gacha={SAMPLE_GACHA}
        animals={animals as never}
        unlocks={{
          counts: {
            nights: 4,
            backlog_done: 1,
            first10s: 13,
            best_streak: 9,
            blocks_closed: 41,
            must_done: 3,
          },
          done: ["first_night", "first_backlog", "streak_7"],
          granted: [],
        }}
        reload={() => {}}
      />
    </div>
  );
}
