"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isCropId, type CropId, type Rarity } from "@/content/crops";
import type { Pity } from "@/lib/game/gacha";
import { getSupabase } from "@/lib/supabase/client";

export type PullResult = { crop: CropId; rarity: Rarity; new: boolean; shards: number };
export type DexEntry = { crop: CropId; count: number; star: number };

export type GachaState = {
  tickets: number;
  pity: Pity;
  shards: Partial<Record<CropId, number>>;
  dex: Partial<Record<CropId, DexEntry>>;
  /** Plantable seeds you own (not counting the free starters). */
  seeds: Partial<Record<CropId, number>>;
};

/** Tickets, pity, Seed-dex and owned seeds; pulls and star-ups go through server RPCs. */
export function useGacha() {
  const client = getSupabase();
  const [state, setState] = useState<GachaState | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [gs, dex, inv] = await Promise.all([
        client.from("game_state").select("tickets, pity, essence").maybeSingle(),
        client.from("seed_dex").select("crop_id, count, star"),
        client.from("inventory").select("item_id, qty").like("item_id", "seed:%"),
      ]);
      if (cancelled || gs.error || dex.error || inv.error) return;
      const seeds: GachaState["seeds"] = {};
      for (const r of (inv.data ?? []) as { item_id: string; qty: number }[]) {
        const id = r.item_id.slice(5);
        if (isCropId(id) && r.qty > 0) seeds[id] = r.qty;
      }
      const dexMap: GachaState["dex"] = {};
      for (const d of (dex.data ?? []) as { crop_id: string; count: number; star: number }[])
        if (isCropId(d.crop_id)) dexMap[d.crop_id] = { crop: d.crop_id, count: d.count, star: d.star };
      setState({
        tickets: (gs.data?.tickets as number | undefined) ?? 0,
        pity: (gs.data?.pity as Pity | undefined) ?? { since_rare: 0, since_epic: 0, since_legendary: 0 },
        shards: (gs.data?.essence as GachaState["shards"] | undefined) ?? {},
        dex: dexMap,
        seeds,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [client, reload]);

  /** Pull 1 or 10; the key makes a retried tap safe (the server never charges twice). */
  const pull = useCallback(
    async (n: 1 | 10, key: string): Promise<PullResult[] | null> => {
      const { data, error } = await client.rpc("pull_gacha", { p_n: n, p_key: key });
      if (error) return null;
      setReload((r) => r + 1);
      return (data.results as PullResult[]).filter((r) => isCropId(r.crop));
    },
    [client],
  );

  const starUp = useCallback(
    async (crop: CropId) => {
      const { error } = await client.rpc("star_up", { p_crop: crop });
      if (!error) setReload((r) => r + 1);
      return !error;
    },
    [client],
  );

  return useMemo(
    () => ({ state, pull, starUp, reload: () => setReload((r) => r + 1) }),
    [state, pull, starUp],
  );
}
