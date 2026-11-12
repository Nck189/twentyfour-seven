"use client";

import { useCallback, useEffect, useState } from "react";
import { COFFEE_ANSWERS, type CoffeeAnswer, type CoffeeSlot, type DrinkId } from "@/content/cafe";
import { getSupabase } from "@/lib/supabase/client";

export type CafeStatus = {
  stamps: number;
  /** Today's real-life answer (wake-day), or null. */
  answer: CoffeeAnswer | null;
  /** The bedtime answer is in. */
  night: boolean;
  gameOnly: boolean;
  /** A coffee/tea was ordered this wake-day (the bedtime question may follow). */
  ordered: boolean;
};
export type OrderResult = {
  stamps: number;
  /** The first full card: the café table. Later cards: a celebration only (never currency). */
  reward: { decor: string } | { card: number } | null;
  /** Ask "in real life too?" now (server: once a wake-day, never when game-only). */
  ask: boolean;
};

const isAnswer = (v: unknown): v is CoffeeAnswer =>
  typeof v === "string" && (COFFEE_ANSWERS as readonly string[]).includes(v);

/** Som's café: status, orders and the real-life answers all go through server RPCs. */
export function useCafe(enabled = true) {
  const client = getSupabase();
  const [status, setStatus] = useState<CafeStatus | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      const r = await client.rpc("cafe_status");
      if (cancelled || r.error || !r.data) return;
      const d = r.data as {
        stamps: number;
        answer: unknown;
        night: boolean;
        game_only: boolean;
        ordered?: boolean;
      };
      setStatus({
        stamps: d.stamps,
        answer: isAnswer(d.answer) ? d.answer : null,
        night: !!d.night,
        gameOnly: !!d.game_only,
        ordered: !!d.ordered,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [client, tick, enabled]);

  const order = useCallback(
    async (drink: DrinkId): Promise<OrderResult | null> => {
      const r = await client.rpc("order_drink", { p_drink: drink });
      if (r.error || !r.data) return null;
      const d = r.data as OrderResult;
      setStatus((s) => (s ? { ...s, stamps: d.stamps } : s));
      return d;
    },
    [client],
  );

  const answer = useCallback(
    async (a: CoffeeAnswer): Promise<boolean> => {
      const r = await client.rpc("answer_coffee", { p_answer: a });
      // Already answered (another tab): the server keeps the first one; just refresh.
      reload();
      return !r.error;
    },
    [client, reload],
  );

  /** "I had another real one" on a "yes" day: the server keeps the latest time of day. */
  const addRealCup = useCallback(async (): Promise<CoffeeSlot | null> => {
    const r = await client.rpc("add_real_cup");
    return r.error ? null : (r.data as CoffeeSlot);
  }, [client]);

  const answerNight = useCallback(
    async (slot: CoffeeSlot): Promise<boolean> => {
      const r = await client.rpc("answer_coffee_night", { p_slot: slot });
      reload();
      return !r.error;
    },
    [client, reload],
  );

  const setGameOnly = useCallback(
    async (on: boolean): Promise<boolean> => {
      const { data: auth } = await client.auth.getUser();
      if (!auth.user) return false;
      const r = await client.from("profiles").update({ cafe_game_only: on }).eq("user_id", auth.user.id);
      if (!r.error) setStatus((s) => (s ? { ...s, gameOnly: on } : s));
      return !r.error;
    },
    [client],
  );

  return { status, order, answer, addRealCup, answerNight, setGameOnly, reload };
}
