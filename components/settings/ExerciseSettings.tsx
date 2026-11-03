"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { logEvent } from "@/lib/db/events";
import { getSupabase } from "@/lib/supabase/client";

/**
 * Weekly exercise goal + gym close time (SPEC §6). Saves at once; the first save also sets up
 * the "exercise" setup row (animal feed, SPEC §8.8c), which the server checks.
 */
export function ExerciseSettings({ onSaved }: { onSaved?: () => void }) {
  const t = useTranslations("exercise");
  const client = getSupabase();
  const [userId, setUserId] = useState<string | null>(null);
  const [goal, setGoal] = useState(3);
  const [gym, setGym] = useState("22:00");
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  // What the server has, so a no-op blur never saves (or pays the setup reward) (R-M8-4).
  const [saved, setSaved] = useState<{ goal: number; gym: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await client.auth.getUser();
      if (!data.user || cancelled) return;
      const { data: s } = await client
        .from("settings")
        .select("weekly_exercise_goal, gym_close_time")
        .eq("user_id", data.user.id)
        .single();
      if (cancelled || !s) return;
      setUserId(data.user.id);
      setGoal(s.weekly_exercise_goal as number);
      setGym((s.gym_close_time as string).slice(0, 5));
      setSaved({ goal: s.weekly_exercise_goal as number, gym: (s.gym_close_time as string).slice(0, 5) });
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  const save = async (patch: { weekly_exercise_goal?: number; gym_close_time?: string }) => {
    if (!userId || !saved) return;
    const { error } = await client.from("settings").update(patch).eq("user_id", userId);
    if (error) {
      // Roll back to what the server has.
      setGoal(saved.goal);
      setGym(saved.gym);
      setState("error");
      return;
    }
    setSaved({ goal: patch.weekly_exercise_goal ?? saved.goal, gym: patch.gym_close_time ?? saved.gym });
    setState("saved");
    await logEvent("exercise_settings_saved", patch);
    onSaved?.();
  };

  const step = (d: number) => {
    const next = Math.min(14, Math.max(1, goal + d));
    if (next === goal) return;
    setGoal(next);
    void save({ weekly_exercise_goal: next });
  };
  const ready = saved !== null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold">{t("goal")}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={t("less")}
            onClick={() => step(-1)}
            disabled={!ready || goal <= 1}
            className="tap h-11 w-11 shrink-0 rounded-full bg-surface-2 text-xl font-bold disabled:opacity-40"
          >
            −
          </button>
          <span className="min-w-24 text-center" aria-live="polite">
            {t("goalValue", { n: goal })}
          </span>
          <button
            type="button"
            aria-label={t("more")}
            onClick={() => step(1)}
            disabled={!ready || goal >= 14}
            className="tap h-11 w-11 shrink-0 rounded-full bg-surface-2 text-xl font-bold disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>
      <label className="flex items-center justify-between gap-2">
        <span className="font-bold">{t("gymClose")}</span>
        <input
          type="time"
          value={gym}
          onChange={(e) => setGym(e.target.value)}
          disabled={!ready}
          onBlur={() => {
            if (saved && gym && gym !== saved.gym) void save({ gym_close_time: gym });
          }}
          className="min-h-11 rounded-xl bg-surface-2 px-3"
        />
      </label>
      {state === "saved" && (
        <p role="status" className="text-sm text-muted">
          {t("saved")}
        </p>
      )}
      {state === "error" && (
        <p role="alert" className="rounded-xl bg-accent-soft p-3 text-sm font-bold">
          {t("saveError")}
        </p>
      )}
    </div>
  );
}
