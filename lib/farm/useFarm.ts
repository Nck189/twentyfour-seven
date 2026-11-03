"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BLOCK_KEYS, type BlockKey } from "@/content/blocks";
import { isCropId, type CropId } from "@/content/crops";
import {
  buildDayFacts,
  farmState,
  type DayMode,
  type FarmState,
  type LogRow,
  type Planting,
} from "@/lib/game";
import { QUIET_RETRY_MS } from "@/lib/supabase/fetchWithTimeout";
import { getSupabase } from "@/lib/supabase/client";
import { addDays } from "@/lib/time";
import { loadDayContext } from "@/lib/today/loadContext";
import { currentBlock, currentDayDate, timelineFor } from "@/lib/today/day";
import { FARM_HISTORY_DAYS, skyPhaseFor, type SkyPhase } from "./sky";

type PlotRow = {
  slot: string;
  crop_id: string | null;
  star: number;
  planted_on: string | null;
  harvested_on: string | null;
};

export type FarmData = {
  farm: FarmState;
  /** Block plots with nothing planted. */
  empty: BlockKey[];
  sky: SkyPhase;
  today: string;
};

/**
 * The farm (SPEC §8): plantings from `plots`, everything else computed by lib/game from the
 * logs. Planting and harvesting go through server RPCs (the server re-checks ripeness).
 */
export function useFarm() {
  const client = getSupabase();
  const [data, setData] = useState<FarmData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reload, setReload] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let retried = false;
    const load = async () => {
      const { ctx, userId: uid } = await loadDayContext(client, -1, 1);
      const now = new Date();
      const today = currentDayDate(ctx, now);
      const plots = await client.from("plots").select("slot, crop_id, star, planted_on, harvested_on");
      if (plots.error) throw plots.error;
      const plantings: Planting[] = (plots.data as PlotRow[]).flatMap((p) =>
        (BLOCK_KEYS as readonly string[]).includes(p.slot) && isCropId(p.crop_id) && p.planted_on
          ? [
              {
                slot: p.slot as BlockKey,
                cropId: p.crop_id as CropId,
                star: p.star,
                plantedOn: p.planted_on,
                harvestedOn: p.harvested_on,
              },
            ]
          : [],
      );
      const oldest = plantings.reduce((m, p) => (p.plantedOn < m ? p.plantedOn : m), today);
      const from = [addDays(oldest, -1), addDays(today, -FARM_HISTORY_DAYS)].sort().at(-1)!;
      const [logs, plans, wakes, nights, ex] = await Promise.all([
        client.from("block_logs").select("*").gte("date", from),
        client.from("day_plans").select("date, mode").gte("date", from),
        client.from("wake_events").select("date, in_window, backfilled").gte("date", from),
        client.from("ticket_grants").select("ref_date").eq("reason", "night").gte("ref_date", from),
        client
          .from("exercise_logs")
          .select("at")
          .gte("at", `${addDays(from, -1)}T00:00:00Z`),
      ]);
      const err = logs.error ?? plans.error ?? wakes.error ?? nights.error ?? ex.error;
      if (err) throw err;
      const days = buildDayFacts({
        from,
        today,
        timezone: ctx.timezone,
        logs: logs.data as LogRow[],
        modes: Object.fromEntries(
          (plans.data as { date: string; mode: DayMode }[]).map((p) => [p.date, p.mode]),
        ),
        wakes: wakes.data as { date: string; in_window: boolean; backfilled: boolean }[],
        nights: (nights.data as { ref_date: string }[]).map((n) => n.ref_date),
        exercise: (ex.data as { at: string }[]).map((e) => e.at),
      });
      const block = currentBlock(timelineFor(ctx, today), now)?.key;
      const planted = new Set(plantings.map((p) => p.slot));
      return {
        uid,
        data: {
          farm: farmState(plantings, days, uid),
          empty: BLOCK_KEYS.filter((b) => !planted.has(b)),
          sky: skyPhaseFor(block),
          today,
        },
      };
    };
    const run = () =>
      load()
        .then((r) => {
          if (cancelled) return;
          setUserId(r.uid);
          setData(r.data);
          setStatus("ready");
        })
        .catch(() => {
          if (cancelled) return;
          // A failed refresh keeps the farm on screen; a failed first load retries once quietly.
          if (!retried) {
            retried = true;
            setTimeout(() => !cancelled && void run(), QUIET_RETRY_MS);
            return;
          }
          setStatus((s) => (s === "ready" ? s : "error"));
        });
    void run();
    return () => {
      cancelled = true;
    };
  }, [client, reload]);

  // Planting/harvest on another device shows here too.
  useEffect(() => {
    if (!userId) return;
    const channel = client
      .channel(`farm-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "plots", filter: `user_id=eq.${userId}` },
        () => setReload((r) => r + 1),
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, userId]);

  const plant = useCallback(
    async (slot: BlockKey, crop: CropId, replace = false) => {
      const { error } = await client.rpc("plant_seed", { p_slot: slot, p_crop: crop, p_replace: replace });
      if (!error) setReload((r) => r + 1);
      return !error;
    },
    [client],
  );

  const harvest = useCallback(
    async (slot: BlockKey) => {
      const { error } = await client.rpc("harvest_plot", { p_slot: slot });
      if (!error) setReload((r) => r + 1);
      return !error;
    },
    [client],
  );

  return useMemo(
    () => ({ data, status, plant, harvest, reload: () => setReload((r) => r + 1) }),
    [data, status, plant, harvest],
  );
}
