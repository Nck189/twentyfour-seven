"use client";

import { useCallback, useEffect, useState } from "react";
import { isMachineId, isProductId, KPI_WINDOW_DAYS, type MachineId, type ProductId } from "@/content/factory";
import type { JobRow, MachineRow, Stock } from "@/lib/game/factory";
import { notifyWalletChange } from "@/lib/market/changes";
import { getSupabase } from "@/lib/supabase/client";

export type FactoryData = { machines: MachineRow[]; jobs: JobRow[]; stock: Stock; coins: number };
/** Why an action was refused (server error codes → what the sheet says). */
export type FactoryError = "coins" | "full" | "inputs" | "error";

const asError = (code: string | undefined, message: string | undefined): FactoryError => {
  if (code !== "P0001") return "error";
  if (/coins/.test(message ?? "")) return "coins";
  if (/full/.test(message ?? "")) return "full";
  if (/not enough/.test(message ?? "")) return "inputs";
  return "error";
};

/** The factory (M13): reads own rows (RLS); every change is a server RPC with the server's clock. */
export function useFactory(enabled = true) {
  const client = getSupabase();
  const [data, setData] = useState<FactoryData | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      const since = new Date(Date.now() - (KPI_WINDOW_DAYS + 1) * 24 * 3_600_000).toISOString();
      try {
        const [m, j, inv, gs] = await Promise.all([
          client.from("machines").select("machine_id, speed_level, capacity_level, bought_at"),
          client
            .from("production_jobs")
            .select("id, machine_id, recipe_id, created_at, start_at, ready_at, collected_at")
            .or(`collected_at.is.null,ready_at.gte.${since}`)
            .order("start_at"),
          client.from("inventory").select("item_id, qty").gt("qty", 0),
          client.from("game_state").select("coins").maybeSingle(),
        ]);
        if (cancelled) return;
        if (m.error || j.error || inv.error || gs.error) {
          setFailed(true);
          return;
        }
        setFailed(false);
        setData({
          machines: (m.data as MachineRow[]).filter((x) => isMachineId(x.machine_id)),
          jobs: (j.data as JobRow[]).filter((x) => isMachineId(x.machine_id) && isProductId(x.recipe_id)),
          stock: inv.data as Stock,
          coins: (gs.data as { coins: number } | null)?.coins ?? 0,
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, tick, enabled]);

  const call = useCallback(
    async (fn: string, args: Record<string, unknown>): Promise<FactoryError | null> => {
      const r = await client.rpc(fn, args);
      reload();
      // Coins and stock changed: the market shelf and the coin counts elsewhere reload.
      if (!r.error) notifyWalletChange();
      return r.error ? asError(r.error.code, r.error.message) : null;
    },
    [client, reload],
  );

  return {
    data,
    failed,
    reload,
    build: (m: MachineId) => call("buy_machine", { p_machine: m }),
    upgrade: (m: MachineId, track: "speed" | "capacity") =>
      call("upgrade_machine", { p_machine: m, p_track: track }),
    start: (m: MachineId, recipe: ProductId) => call("start_job", { p_machine: m, p_recipe: recipe }),
    collect: async (m: MachineId | null): Promise<number | null> => {
      const r = await client.rpc("collect_jobs", { p_machine: m });
      reload();
      if (!r.error) notifyWalletChange();
      return r.error ? null : ((r.data as { n: number } | null)?.n ?? 0);
    },
  };
}
