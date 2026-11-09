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
 * An account older than that is revealed too: its days settle when Today opens, which may run
 * after this check (R-M9-8).
 */
export function useStatsRevealed(): boolean {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const client = getSupabase();
      const [{ count, error }, profile] = await Promise.all([
        client.from("day_results").select("date", { count: "exact", head: true }),
        client.from("profiles").select("created_at").maybeSingle(),
      ]);
      if (cancelled || error || count === null) return;
      setShown(count >= REVEALS.statsAfterDays || accountOldEnough(profile.data?.created_at, new Date()));
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return shown;
}

/** Old enough that settling gives the Stats days (a full day more, for the wake-day boundary). */
export function accountOldEnough(createdAt: string | null | undefined, now: Date): boolean {
  if (!createdAt) return false;
  return now.getTime() - Date.parse(createdAt) >= (REVEALS.statsAfterDays + 1) * 86_400_000;
}
