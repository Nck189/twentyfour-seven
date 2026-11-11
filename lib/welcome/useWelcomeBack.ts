"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

export type WelcomeBack = {
  awayDays: number;
  lapsed: boolean;
  goal: { start: string; ends: string; done: number; need: number; claimed: boolean } | null;
  today: string;
};

/**
 * Welcome back (playtest R1 R3): the server says whether this is a return after 2+ away days and
 * how the 3-day "back on track" goal stands; claiming is the server's call too.
 */
export function useWelcomeBack() {
  const client = getSupabase();
  const [state, setState] = useState<WelcomeBack | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await client.rpc("welcome_back_status");
      if (cancelled || error || !data) return;
      const d = data as { away_days: number; lapsed: boolean; goal: WelcomeBack["goal"]; today: string };
      setState({ awayDays: d.away_days, lapsed: d.lapsed, goal: d.goal, today: d.today });
    })();
    return () => {
      cancelled = true;
    };
  }, [client, tick]);

  const claim = useCallback(
    async (fn: "claim_welcome_back" | "claim_back_on_track") => {
      const { data, error } = await client.rpc(fn);
      setTick((n) => n + 1);
      return !error && Boolean((data as { granted?: boolean } | null)?.granted);
    },
    [client],
  );
  return {
    state,
    claimWelcome: () => claim("claim_welcome_back"),
    claimGoal: () => claim("claim_back_on_track"),
  };
}
