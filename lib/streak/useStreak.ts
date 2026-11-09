"use client";

import { useCallback, useEffect, useState } from "react";
import type { DayKind } from "@/lib/game/streak";
import { getSupabase } from "@/lib/supabase/client";
import { addDays } from "@/lib/time";

export type StreakGrant = {
  reason: "perfect_day" | "streak_7" | "streak_14" | "streak_30";
  /** Streak length a streak ticket was paid for (60, 90, … come as `streak_30`). */
  days?: number;
  date: string;
  amount: number;
};
export type StreakView = {
  streak: number;
  best: number;
  freezes: number;
  /** The current wake-day (server). */
  today: string;
  /** Settled days of the last 5 weeks, by date. */
  days: Record<string, DayKind>;
  /** Tickets paid by this settle (shown once). */
  granted: StreakGrant[];
};

const KINDS: DayKind[] = ["perfect", "minimum", "frozen", "paused", "missed"];

/**
 * The streak (SPEC §8.7): asks the server to settle finished days (it pays the Perfect day and
 * milestone tickets), then reads the last 5 weeks. Before the M9 migration it stays null.
 */
export function useStreak() {
  const client = getSupabase();
  const [view, setView] = useState<StreakView | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const s = await client.rpc("settle_days");
      if (cancelled || s.error || !s.data) return;
      const today = s.data.today as string;
      const rows = await client.from("day_results").select("date, kind").gte("date", addDays(today, -35));
      if (cancelled) return;
      const days: Record<string, DayKind> = {};
      for (const r of (rows.data ?? []) as { date: string; kind: string }[])
        if ((KINDS as string[]).includes(r.kind)) days[r.date] = r.kind as DayKind;
      setView({
        streak: s.data.streak as number,
        best: s.data.best as number,
        freezes: s.data.freezes as number,
        today,
        days,
        granted: (s.data.granted as StreakGrant[]) ?? [],
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [client, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { view, reload };
}
