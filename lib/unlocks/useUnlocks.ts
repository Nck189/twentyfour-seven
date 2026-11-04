"use client";

import { useEffect, useState } from "react";
import { isUnlockId, REVEALS, type UnlockId } from "@/content/unlocks";
import type { UnlockCounts } from "@/lib/game/unlocks";
import { getSupabase } from "@/lib/supabase/client";

export type UnlocksState = { counts: Partial<UnlockCounts>; done: string[]; granted: UnlockId[] };

/**
 * The unlock ladder (SPEC §8.8b): asks the server to pay every unlock reached (it counts from
 * the data); re-run when `dep` changes (e.g. after the streak settles). Null before M9 is on prod.
 */
export function useUnlocks(dep?: unknown) {
  const [state, setState] = useState<UnlocksState | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await getSupabase().rpc("claim_unlocks");
      if (cancelled || error || !data) return;
      const d = data as { counts: Partial<UnlockCounts>; done: string[]; granted: unknown[] };
      // Keep what earlier claims in this visit paid, so a re-claim can't hide the notice.
      setState((prev) => ({
        counts: d.counts ?? {},
        done: d.done ?? [],
        granted: [...new Set([...(prev?.granted ?? []), ...d.granted.filter(isUnlockId)])],
      }));
    })();
    return () => {
      cancelled = true;
    };
  }, [dep]);
  return state;
}

/**
 * Feature reveals (SPEC §8.8b): Stats shows after a few settled days. Unknown (still loading, or
 * the table isn't on the server yet) counts as revealed, so nothing an existing user had goes away.
 */
export function useStatsRevealed(): boolean {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { count, error } = await getSupabase()
        .from("day_results")
        .select("date", { count: "exact", head: true });
      if (cancelled || error || count === null) return;
      setShown(count >= REVEALS.statsAfterDays);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return shown;
}
