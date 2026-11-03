"use client";

import { useSearchParams } from "next/navigation";
import { FarmView } from "@/components/farm/FarmScreen";
import { BLOCK_KEYS, type BlockKey } from "@/content/blocks";
import type { SkyPhase } from "@/lib/farm/sky";
import { farmState, type DayFacts, type GameLog, type Planting } from "@/lib/game";
import { addDays } from "@/lib/time";

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

export function FarmPreview() {
  const q = useSearchParams().get("sky");
  const sky = SKIES.find((s) => s === q) ?? "day";
  const farm = farmState(PLANTINGS, sampleDays(), "preview");
  const planted = new Set(PLANTINGS.map((p) => p.slot));
  return (
    <div className="mx-auto max-w-3xl py-2">
      <FarmView
        data={{ farm, sky, today: TODAY, empty: BLOCK_KEYS.filter((b) => !planted.has(b)) }}
        status="ready"
        plant={async () => true}
        harvest={async () => true}
        reload={() => {}}
      />
    </div>
  );
}
