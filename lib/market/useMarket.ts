"use client";

import { useCallback, useEffect, useState } from "react";
import type { CropId } from "@/content/crops";
import type { UpgradeTrack } from "@/content/economy";
import { getSupabase } from "@/lib/supabase/client";
import { onWalletChange } from "./changes";

export type MarketStatus = {
  today: string;
  coins: number;
  levels: Record<UpgradeTrack, number>;
  shelf: { item: string; qty: number; price: number }[];
  seeds: { crop: CropId; price: number }[];
  orders: { slot: number; crop: CropId; qty: number; coins: number; done: boolean }[];
  exchange: { price: number; max: number; used: number };
};
export type Reward = { id: string; title: string; cost: number };
/** An action's outcome: refused = the server said no (coins, limits), not a network failure. */
export type ActResult = { ok: boolean; refused: boolean; data: Record<string, unknown> | null };

/**
 * The farm shop (docs/ECONOMY.md): what the server says is on offer, and actions that ask the
 * server to sell, buy or deliver. Prices and outcomes are never decided here.
 */
export function useMarket() {
  const client = getSupabase();
  const [status, setStatus] = useState<MarketStatus | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  // A harvest, collected produce or a decor purchase elsewhere on the page changes the shelf/coins.
  useEffect(() => onWalletChange(reload), [reload]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [s, r] = await Promise.all([
        client.rpc("market_status"),
        client.from("rewards").select("id, title, cost").eq("archived", false).order("created_at"),
      ]);
      if (cancelled) return;
      if (s.error || !s.data) {
        setError(true);
        return;
      }
      setError(false);
      setStatus(s.data as MarketStatus);
      setRewards((r.data ?? []) as Reward[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [client, tick]);

  /** Runs one server action; true on success. The shop reloads either way. */
  const act = useCallback(
    async (fn: string, args: Record<string, unknown> = {}): Promise<ActResult> => {
      const { data, error: err } = await client.rpc(fn, args);
      reload();
      return {
        ok: !err,
        refused: ["P0001", "P0002", "22023"].includes(err?.code ?? ""),
        data: (data as Record<string, unknown> | null) ?? null,
      };
    },
    [client, reload],
  );

  return {
    status,
    rewards,
    error,
    reload,
    sell: (item: string, qty: number) => act("sell_produce", { p_item: item, p_qty: qty }),
    buySeed: (crop: CropId) => act("buy_seed", { p_crop: crop }),
    exchange: () => act("exchange_ticket"),
    upgrade: (track: UpgradeTrack) => act("buy_upgrade", { p_track: track }),
    deliver: (slot: number) => act("deliver_order", { p_slot: slot }),
    redeem: (id: string) => act("redeem_reward", { p_id: id }),
    addReward: async (title: string, cost: number): Promise<ActResult> => {
      const { error: err } = await client.from("rewards").insert({ title: title.trim(), cost });
      reload();
      return { ok: !err, refused: false, data: null };
    },
    removeReward: async (id: string): Promise<ActResult> => {
      const { error: err } = await client.from("rewards").update({ archived: true }).eq("id", id);
      reload();
      return { ok: !err, refused: false, data: null };
    },
  };
}
