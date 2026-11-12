"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BLOCK_KEYS, type BlockKey } from "@/content/blocks";
import { isCropId, type CropId } from "@/content/crops";
import { isDecorId, type DecorId } from "@/content/decor";
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
import { notifyWalletChange } from "@/lib/market/changes";
import { addDays } from "@/lib/time";
import { loadDayContext } from "@/lib/today/loadContext";
import { currentBlock, currentDayDate, timelineFor } from "@/lib/today/day";
import { FARM_HISTORY_DAYS, skyPhaseFor, type SkyPhase } from "./sky";

type PlotRow = {
  slot: string;
  crop_id: string | null;
  star: number;
  planted_on: string | null;
  harvested_on?: string | null;
};

export type FarmData = {
  farm: FarmState;
  /** Block plots with nothing planted. */
  empty: BlockKey[];
  coins: number;
  /** Decor bought, oldest first (SPEC §8.9). */
  decor: DecorId[];
  sky: SkyPhase;
  today: string;
  /** Farmhouse upgrade level (economy v2); 0 = no house yet. */
  house: number;
  /** Market stall level: the harvest pop's price includes its bonus. */
  stall: number;
};

/**
 * The farm (SPEC §8): plantings from `plots`, everything else computed by lib/game from the
 * logs. Planting and harvesting go through server RPCs (the server re-checks ripeness).
 */
const levelOf = (rows: unknown, track: string): number =>
  ((rows as { track: string; level: number }[] | null) ?? []).find((r) => r.track === track)?.level ?? 0;

export function useFarm({ live = true, delayMs = 0 }: { live?: boolean; delayMs?: number } = {}) {
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
      let plots = await client.from("plots").select("slot, crop_id, star, planted_on, harvested_on");
      // Before the M6 migration reaches prod there's no harvested_on: read without it (the farm
      // shows; planting answers "Couldn't do that" until the RPCs exist).
      if (plots.error?.code === "42703")
        plots = await client.from("plots").select("slot, crop_id, star, planted_on");
      if (plots.error) throw plots.error;
      const plantings: Planting[] = (plots.data as PlotRow[]).flatMap((p) =>
        (BLOCK_KEYS as readonly string[]).includes(p.slot) && isCropId(p.crop_id) && p.planted_on
          ? [
              {
                slot: p.slot as BlockKey,
                cropId: p.crop_id as CropId,
                star: p.star,
                plantedOn: p.planted_on,
                harvestedOn: p.harvested_on ?? null,
              },
            ]
          : [],
      );
      const oldest = plantings.reduce((m, p) => (p.plantedOn < m ? p.plantedOn : m), today);
      const from = [addDays(oldest, -1), addDays(today, -FARM_HISTORY_DAYS)].sort().at(-1)!;
      const [logs, plans, wakes, nights, ex, game, decorRows, houseRow] = await Promise.all([
        client.from("block_logs").select("*").gte("date", from),
        client.from("day_plans").select("date, mode, late_night").gte("date", from),
        client.from("wake_events").select("date, in_window, backfilled").gte("date", from),
        client.from("ticket_grants").select("ref_date").eq("reason", "night").gte("ref_date", from),
        client
          .from("exercise_logs")
          .select("at")
          .gte("at", `${addDays(from, -1)}T00:00:00Z`),
        client.from("game_state").select("coins").maybeSingle(),
        client.from("decor").select("item_id").order("created_at"),
        // Optional: before the economy migration there's no table; the farm shows without a house.
        client.from("upgrades").select("track, level"),
      ]);
      const err =
        logs.error ?? plans.error ?? wakes.error ?? nights.error ?? ex.error ?? game.error ?? decorRows.error;
      if (err) throw err;
      const days = buildDayFacts({
        from,
        today,
        timezone: ctx.timezone,
        logs: logs.data as LogRow[],
        lateNights: (plans.data as { date: string; late_night: unknown }[])
          .filter((p) => p.late_night)
          .map((p) => p.date),
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
          coins: (game.data?.coins as number | undefined) ?? 0,
          decor: ((decorRows.data ?? []) as { item_id: string }[]).map((d) => d.item_id).filter(isDecorId),
          today,
          house: levelOf(houseRow.data, "house"),
          stall: levelOf(houseRow.data, "stall"),
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
    // A secondary reader (Today's warning line) waits a moment, so the page's own requests go first.
    const start = delayMs > 0 ? setTimeout(() => void run(), delayMs) : null;
    if (!start) void run();
    return () => {
      cancelled = true;
      if (start) clearTimeout(start);
    };
  }, [client, reload, delayMs]);

  // Planting/harvest on another device shows here too.
  useEffect(() => {
    if (!userId || !live) return;
    const channel = client
      .channel(`farm-${userId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "plots", filter: `user_id=eq.${userId}` },
        () => setReload((r) => r + 1),
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, userId, live]);

  const plant = useCallback(
    async (slot: BlockKey, crop: CropId, replace = false) => {
      const { error } = await client.rpc("plant_seed", { p_slot: slot, p_crop: crop, p_replace: replace });
      if (!error) setReload((r) => r + 1);
      return !error;
    },
    [client],
  );

  const harvest = useCallback(
    /** The produce item the server stored (its quality and weather), or null on failure. */
    async (slot: BlockKey): Promise<string | null> => {
      const { data, error } = await client.rpc("harvest_plot", { p_slot: slot });
      if (error) return null;
      setReload((r) => r + 1);
      notifyWalletChange();
      const r = data as { item?: string; crop: string };
      return r.item ?? `crop:${r.crop}`; // before the economy migration: no item in the reply
    },
    [client],
  );

  const buyDecor = useCallback(
    async (item: DecorId) => {
      const { error } = await client.rpc("buy_decor", { p_item: item });
      if (!error) {
        setReload((r) => r + 1);
        notifyWalletChange();
      }
      return !error;
    },
    [client],
  );

  return useMemo(
    () => ({ data, status, plant, harvest, buyDecor, reload: () => setReload((r) => r + 1) }),
    [data, status, plant, harvest, buyDecor],
  );
}
