"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  isAnimalId,
  isExerciseType,
  type AnimalId,
  type ExerciseType,
  type ProduceId,
} from "@/content/animals";
import type { Rarity } from "@/content/crops";
import { notifyWalletChange } from "@/lib/market/changes";
import { getSupabase } from "@/lib/supabase/client";
import { addDays, DEFAULT_TZ, isoWeekday, localDate, zonedInstant } from "@/lib/time";

export type Animal = {
  id: string;
  species: AnimalId;
  love: number;
  fedUntil: Date | null;
  lastProduced: Date | null;
  createdAt: Date;
};

export type Workout = { at: string; type: ExerciseType; minutes: number; counted: boolean };

export type AnimalsState = {
  animals: Animal[];
  /** Workouts toward the next egg (0–2). */
  eggProgress: number;
  /** Feed bags owned (setup reward). */
  feed: number;
  /** Workouts logged this local week (Mon–Sun). */
  week: Workout[];
  weeklyGoal: number;
  gymClose: string;
  timezone: string;
};

export type LogResult = {
  counted: boolean;
  eggProgress: number;
  hatched: { id: string; species: AnimalId; rarity: Rarity } | null;
};

const row = (a: Record<string, unknown>): Animal | null =>
  isAnimalId(a.species)
    ? {
        id: a.id as string,
        species: a.species,
        love: (a.love as number) ?? 0,
        fedUntil: a.fed_until ? new Date(a.fed_until as string) : null,
        lastProduced: a.last_produced ? new Date(a.last_produced as string) : null,
        createdAt: new Date(a.created_at as string),
      }
    : null;

/** A unique key per tap; randomUUID is missing on plain http and older iOS. */
const newKey = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Array.from(crypto.getRandomValues(new Uint32Array(4)), (x) => x.toString(36)).join("")}`;

/**
 * Exercise + animals (SPEC §6, §8.6). Reads are plain selects; every change (log, pet, collect,
 * feed) is a server RPC, so feed, eggs, hatches and love are decided server-side.
 */
export function useAnimals() {
  const client = getSupabase();
  const [state, setState] = useState<AnimalsState | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: auth } = await client.auth.getUser();
      if (!auth.user) return;
      const [profile, settings, gs, animals, inv] = await Promise.all([
        client.from("profiles").select("timezone").eq("user_id", auth.user.id).maybeSingle(),
        client
          .from("settings")
          .select("weekly_exercise_goal, gym_close_time")
          .eq("user_id", auth.user.id)
          .single(),
        client.from("game_state").select("egg_progress").eq("user_id", auth.user.id).maybeSingle(),
        client
          .from("animals")
          .select("id, species, love, fed_until, last_produced, created_at")
          .order("created_at"),
        client.from("inventory").select("qty").eq("item_id", "feed").maybeSingle(),
      ]);
      const tz = (profile.data?.timezone as string | undefined) ?? DEFAULT_TZ;
      const today = localDate(new Date(), tz);
      const monday = addDays(today, 1 - isoWeekday(today));
      const logs = await client
        .from("exercise_logs")
        .select("at, type, minutes, counted")
        .gte("at", zonedInstant(monday, 0, tz).toISOString())
        .order("at");
      if (cancelled) return;
      if (settings.error || animals.error || logs.error) {
        setStatus("error");
        return;
      }
      setState({
        animals: (animals.data ?? [])
          .map((a) => row(a as Record<string, unknown>))
          .filter((a): a is Animal => !!a),
        // Before the M8 migration is on prod there's no egg_progress: 0.
        eggProgress: ((gs.data as { egg_progress?: number } | null)?.egg_progress as number | undefined) ?? 0,
        feed: (inv.data?.qty as number | undefined) ?? 0,
        week: ((logs.data ?? []) as Record<string, unknown>[])
          .filter((l) => isExerciseType(l.type))
          .map((l) => ({
            at: l.at as string,
            type: l.type as ExerciseType,
            minutes: l.minutes as number,
            counted: Boolean(l.counted),
          })),
        weeklyGoal: (settings.data.weekly_exercise_goal as number) ?? 3,
        gymClose: ((settings.data.gym_close_time as string) ?? "22:00").slice(0, 5),
        timezone: tz,
      });
      setStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [client, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  /** Logs a workout; one key per tap, retried once with the same key (never logged twice). */
  const logExercise = useCallback(
    async (type: ExerciseType, minutes: number): Promise<LogResult | null> => {
      const key = `ex-${newKey()}`;
      const call = () => client.rpc("log_exercise", { p_type: type, p_minutes: minutes, p_key: key });
      let res = await call();
      if (res.error && res.error.code !== "22023") res = await call();
      if (res.error) return null;
      const d = res.data as { counted: boolean; egg_progress: number; hatched: LogResult["hatched"] };
      reload();
      return {
        counted: d.counted,
        eggProgress: d.egg_progress,
        hatched: d.hatched && isAnimalId(d.hatched.species) ? d.hatched : null,
      };
    },
    [client, reload],
  );

  const pet = useCallback(
    async (id: string): Promise<boolean> => {
      const { data, error } = await client.rpc("pet_animal", { p_id: id });
      if (error) return false;
      setState((s) =>
        s
          ? { ...s, animals: s.animals.map((a) => (a.id === id ? { ...a, love: data.love as number } : a)) }
          : s,
      );
      return Boolean(data.counted);
    },
    [client],
  );

  const collect = useCallback(
    async (id: string): Promise<ProduceId | null> => {
      const { data, error } = await client.rpc("collect_produce", { p_id: id });
      if (error) return null;
      reload();
      notifyWalletChange();
      return data.produce as ProduceId;
    },
    [client, reload],
  );

  const feedOne = useCallback(
    async (id: string): Promise<boolean> => {
      const { error } = await client.rpc("use_feed", { p_id: id });
      if (!error) reload();
      return !error;
    },
    [client, reload],
  );

  return useMemo(
    () => ({ state, status, reload, logExercise, pet, collect, feed: feedOne }),
    [state, status, reload, logExercise, pet, collect, feedOne],
  );
}
