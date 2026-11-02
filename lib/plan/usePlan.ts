"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BlockKey, BlockSetting, ChecklistItem } from "@/content/blocks";
import { logEvent } from "@/lib/db/events";
import { getSupabase } from "@/lib/supabase/client";
import type { DayContext, DayPlanRow } from "@/lib/today/day";
import { emptyDayPlan, loadDayContext } from "@/lib/today/loadContext";

export type DayPatch = Partial<Omit<DayPlanRow, "date" | "overrides">> & {
  /** Merged into overrides.blocks[key]. */
  block?: { key: BlockKey; first10?: string | null; checklist?: ChecklistItem[]; duration_min?: number };
};

const SAVE_DELAY_MS = 400;

/** Pure: applies a patch to a day plan row (templates are never touched). */
export function applyDayPatch(row: DayPlanRow, patch: DayPatch): DayPlanRow {
  const { block, ...fields } = patch;
  const next: DayPlanRow = { ...row, ...fields, overrides: { ...row.overrides } };
  if (block) {
    const { key, ...rest } = block;
    next.overrides.blocks = { ...next.overrides.blocks, [key]: { ...next.overrides.blocks?.[key], ...rest } };
  }
  return next;
}

/**
 * Planning data for the next two weeks. Edits apply to the local engine context at once
 * (live preview) and are saved per day after a short debounce.
 */
export function usePlan() {
  const client = getSupabase();
  const [ctx, setCtx] = useState<DayContext | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [reload, setReload] = useState(0);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const ctxRef = useRef<DayContext | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadDayContext(client, -2, 14)
      .then((r) => {
        if (cancelled) return;
        ctxRef.current = r.ctx;
        setCtx(r.ctx);
        setUserId(r.userId);
        setToday(r.today);
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [client, reload]);

  const persist = useCallback(
    async (date: string) => {
      const row = ctxRef.current?.dayPlans[date];
      if (!row || !userId) return;
      setSaving("saving");
      const { error } = await client.from("day_plans").upsert(
        {
          user_id: userId,
          date,
          template_id: row.template_id,
          attending: row.attending,
          bedtime_override: row.bedtime_override,
          late_night: row.late_night,
          mode: row.mode,
          overrides: row.overrides,
        },
        { onConflict: "user_id,date" },
      );
      setSaving(error ? "error" : "saved");
      if (!error) void logEvent("day_planned", { date });
    },
    [client, userId],
  );

  const updateDay = useCallback(
    (date: string, patch: DayPatch) => {
      const current = ctxRef.current;
      if (!current) return;
      const row = applyDayPatch(current.dayPlans[date] ?? emptyDayPlan(date), patch);
      const next = { ...current, dayPlans: { ...current.dayPlans, [date]: row } };
      ctxRef.current = next;
      setCtx(next);
      clearTimeout(timers.current[date]);
      timers.current[date] = setTimeout(() => void persist(date), SAVE_DELAY_MS);
    },
    [persist],
  );

  /** Flush pending saves now (e.g. before Goodnight). */
  const flush = useCallback(async () => {
    const dates = Object.keys(timers.current);
    dates.forEach((d) => clearTimeout(timers.current[d]));
    timers.current = {};
    await Promise.all(dates.map((d) => persist(d)));
  }, [persist]);

  /** "Save as my default" for a block's checklist / first-10 (settings, all future days). */
  const saveBlockDefault = useCallback(
    async (key: BlockKey, patch: { checklist?: ChecklistItem[]; first10?: string | null }) => {
      const current = ctxRef.current;
      if (!current || !userId) return;
      const blocks: BlockSetting[] = current.blocks.map((b) => (b.key === key ? { ...b, ...patch } : b));
      const next = { ...current, blocks };
      ctxRef.current = next;
      setCtx(next);
      setSaving("saving");
      const { error } = await client.from("settings").update({ blocks }).eq("user_id", userId);
      setSaving(error ? "error" : "saved");
      if (!error) void logEvent("block_default_saved", { block: key });
    },
    [client, userId],
  );

  // Leaving the screen saves pending edits instead of dropping them.
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);
  useEffect(() => () => void flushRef.current(), []);

  return {
    ctx,
    today,
    userId,
    status,
    saving,
    updateDay,
    flush,
    saveBlockDefault,
    reload: () => setReload((r) => r + 1),
  };
}
