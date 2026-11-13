"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { planPushes, type PushBlock } from "@/lib/push/schedule";
import { usePush } from "@/lib/push/usePush";
import { addDays } from "@/lib/time";

/**
 * Uploads today's reminders (M11) whenever the day's blocks or the switches change, in the user's
 * language. Renders nothing. Only when this device has notifications on.
 */
export function PushPlanner({
  day,
  blocks,
  timezone,
  mode = "normal",
}: {
  day: string;
  blocks: readonly PushBlock[];
  timezone: string;
  /** Vacation/Sick days get no block nudges (G7 R-M11-8). */
  mode?: "normal" | "vacation" | "sick";
}) {
  const t = useTranslations("push");
  const names = useTranslations("blocks");
  const { state, prefs } = usePush();
  const last = useRef("");
  const key = blocks
    .map((b) => `${b.key}@${b.start.getTime()}-${b.end.getTime()}:${b.first10 ?? ""}`)
    .join("|");

  useEffect(() => {
    if (state !== "on" || !prefs) return;
    const sig = `${day}|${mode}|${key}|${JSON.stringify(prefs)}`;
    if (sig === last.current) return;
    last.current = sig;
    const plan = planPushes({
      day,
      nextDay: addDays(day, 1),
      blocks,
      prefs,
      tz: timezone,
      now: new Date(),
      mode,
    });
    const items = plan.map((p) => {
      const block = p.block ? names(`name.${p.block}`) : "";
      const first10 = blocks.find((b) => b.key === p.block)?.first10 ?? "";
      return {
        ref: p.ref,
        kind: p.kind,
        day: p.day,
        block: p.block,
        fire_at: p.fireAt.toISOString(),
        title: t(`title.${p.kind}`, { block }).slice(0, 80),
        body: (p.kind === "block_start" || p.kind === "first10"
          ? first10 || t(`body.${p.kind}`)
          : t(`body.${p.kind}`)
        ).slice(0, 200),
      };
    });
    void getSupabase().rpc("set_push_schedule", { p_items: items });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key captures the blocks
  }, [state, prefs, day, key, timezone, mode]);

  return null;
}
