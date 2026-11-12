"use client";

import { useSearchParams } from "next/navigation";
import { StatsBody } from "@/components/stats/StatsScreen";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { BLOCK_KEYS, type BlockKey } from "@/content/blocks";
import type { DayFacts, GameLog } from "@/lib/game";
import type { StatsData } from "@/lib/stats/useStats";
import { addDays, isoWeekday } from "@/lib/time";

const START = "2026-10-12"; // a Monday
const at = (d: string, min: number) => new Date(`${d}T00:00:00+07:00`).getTime() + min * 60_000;
const iso = (ms: number) => new Date(ms).toISOString();

/** A seeded sample: mostly on time, weekends later, a few phone misses, one late morning. */
function sample(review: string | null): StatsData {
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const days: DayFacts[] = [];
  const wakes: StatsData["wakes"] = [];
  const sleep: StatsData["sleep"] = [];
  for (let i = 0; i < 28; i++) {
    const date = addDays(START, i);
    const weekend = isoWeekday(date) >= 6;
    const wake = (weekend ? 540 : 450) + Math.round((rnd() - 0.5) * 30) + (i === 17 ? 150 : 0);
    const logs: Partial<Record<BlockKey, GameLog>> = {};
    BLOCK_KEYS.forEach((b, k) => {
      const planned = at(date, wake + k * 120);
      const miss = rnd() < (b === "work" || b === "down" ? 0.25 : 0.1);
      const late = rnd() < 0.2;
      logs[b] = {
        planned_start: iso(planned),
        started_at: miss ? null : iso(planned + (late ? 25 : 3) * 60_000),
        first10_at: miss || rnd() < 0.15 ? null : iso(planned + 10 * 60_000),
        items_done: Array.from({ length: miss ? 0 : 2 }, (_, j) => `i${j}`),
        items_planned: 2,
        location: rnd() < 0.3 ? "out" : "home",
        backfilled: false,
        planned_deviation: false,
        miss_reason: miss
          ? (["phone", "phone", "sleepy", "social", "interruption"] as const)[Math.floor(rnd() * 5)]!
          : null,
      };
    });
    days.push({
      date,
      mode: i === 9 ? "sick" : "normal",
      logs,
      wakeInWindow: rnd() > 0.15,
      nightRitualDone: rnd() > 0.2,
      exercised: false,
    });
    wakes.push({ date, value: wake });
    sleep.push({ date, bed: 660 + Math.round((rnd() - 0.4) * 60), wake });
  }
  const today = addDays(START, 28);
  return {
    today,
    days,
    wakes,
    sleep,
    review: review === "none" ? null : { week_start: addDays(START, 21), done: review === "done" },
    coffee: { ready: true, late: 9, other: 11, diff: 35 },
  };
}

export function StatsPreview() {
  const params = useSearchParams();
  const review = params.get("review") ?? "open";
  const tab = params.get("tab");
  const data = sample(review);
  const streak = {
    streak: 6,
    best: 9,
    freezes: 1,
    today: data.today,
    days: Object.fromEntries(
      data.days.map((d, i) => [
        d.date,
        i === 9 ? "paused" : i % 7 === 3 ? "missed" : i % 5 === 0 ? "perfect" : "minimum",
      ]),
    ),
    granted: [],
  } as unknown as Parameters<typeof StatsBody>[0]["streak"];
  return (
    <main className="min-h-dvh bg-bg">
      <ScreenHeader title="Stats" subtitle="Preview (sample data)" />
      <StatsBody
        data={data}
        streak={streak}
        initialTab={tab === "sleep" || tab === "days" ? tab : "overview"}
        submit={async () => ({ week_start: addDays(START, 21), granted: true })}
      />
    </main>
  );
}
