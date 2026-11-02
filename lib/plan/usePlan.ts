"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BlockKey, BlockSetting, ChecklistItem } from "@/content/blocks";
import type { FixedEvent } from "@/content/defaults";
import { hostFor, parseHHMM } from "@/lib/engine";
import { addDays, zonedInstant } from "@/lib/time";
import { logEvent } from "@/lib/db/events";
import { getSupabase } from "@/lib/supabase/client";
import { planFor, plannedWake, type DayContext, type DayPlanRow } from "@/lib/today/day";
import { DAY_PLAN_COLUMNS, emptyDayPlan, loadDayContext } from "@/lib/today/loadContext";

export type DayPatch = Partial<Omit<DayPlanRow, "date" | "overrides">> & {
  /** Merged into overrides.blocks[key]. */
  block?: { key: BlockKey; first10?: string | null; checklist?: ChecklistItem[]; duration_min?: number };
  /** One-off fixed events for this day (appointments). */
  fixed_events?: FixedEvent[];
};

const SAVE_DELAY_MS = 400;

/** Pure: applies a patch to a day plan row (templates are never touched). */
export function applyDayPatch(row: DayPlanRow, patch: DayPatch): DayPlanRow {
  const { block, fixed_events, ...fields } = patch;
  const next: DayPlanRow = { ...row, ...fields, overrides: { ...row.overrides } };
  if (fixed_events) next.overrides.fixed_events = fixed_events;
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
  /** Days whose last save failed: kept and retried, never silently dropped. */
  const failed = useRef<Set<string>>(new Set());
  const ctxRef = useRef<DayContext | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadDayContext(client, -2, 14)
      .then(async (r) => {
        // Appointments can be months ahead: load every later day that has one.
        const later = await client
          .from("day_plans")
          .select(DAY_PLAN_COLUMNS)
          .gt("date", addDays(r.today, 14))
          .not("overrides->fixed_events", "is", null);
        for (const row of (later.data ?? []) as DayPlanRow[]) r.ctx.dayPlans[row.date] = row;
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
      if (!row || !userId) return false;
      setSaving("saving");
      let planned: ReturnType<typeof plannedWake> | null = null;
      try {
        planned = plannedWake(ctxRef.current!, date); // so the server honors a planned push
      } catch {
        // No template for that day: the server falls back to its own target.
      }
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
          ...(planned ? { planned } : {}),
        },
        { onConflict: "user_id,date" },
      );
      if (error) failed.current.add(date);
      else failed.current.delete(date);
      setSaving(error ? "error" : "saved");
      if (!error) void logEvent("day_planned", { date });
      return !error;
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

  /**
   * Saves pending and previously failed days now (e.g. before Goodnight). Resolves false if any
   * still failed; those stay queued and are retried when the connection comes back (R-M4-5).
   */
  const flush = useCallback(async () => {
    const dates = [...new Set([...Object.keys(timers.current), ...failed.current])];
    Object.values(timers.current).forEach((t) => clearTimeout(t));
    timers.current = {};
    const results = await Promise.all(dates.map((d) => persist(d)));
    return results.every(Boolean);
  }, [persist]);
  useEffect(() => {
    const onOnline = () => {
      if (failed.current.size) void flush();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flush]);

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

  /** Upcoming appointments (any distance ahead), soonest first. */
  const appointments = useMemo(
    () =>
      ctx && today
        ? Object.values(ctx.dayPlans)
            .filter((r) => r && r.date >= today)
            .flatMap((r) =>
              (r!.overrides.fixed_events ?? [])
                .filter((e) => e.key === "appointment")
                .map((e) => ({ ...e, date: r!.date })),
            )
            .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
        : [],
    [ctx, today],
  );

  /** Adds a one-off appointment; it lives in the block its start time falls in (else Work). */
  const addAppointment = useCallback(
    async (date: string, title: string, start: string, end: string) => {
      const current = ctxRef.current;
      if (!current) return;
      let host: BlockKey = "work";
      try {
        host = hostFor(planFor(current, date), zonedInstant(date, parseHHMM(start), current.timezone));
      } catch {
        // No template for that day: keep Work.
      }
      const existing = current.dayPlans[date]?.overrides.fixed_events ?? [];
      updateDay(date, {
        fixed_events: [...existing, { id: crypto.randomUUID(), key: "appointment", title, start, end, host }],
      });
      await flush();
      void logEvent("appointment_added", { date, host });
    },
    [flush, updateDay],
  );

  const removeAppointment = useCallback(
    async (date: string, id: string) => {
      const existing = ctxRef.current?.dayPlans[date]?.overrides.fixed_events ?? [];
      updateDay(date, { fixed_events: existing.filter((e) => e.id !== id) });
      await flush();
      void logEvent("appointment_removed", { date });
    },
    [flush, updateDay],
  );

  return {
    ctx,
    today,
    userId,
    appointments,
    addAppointment,
    removeAppointment,
    status,
    saving,
    updateDay,
    flush,
    saveBlockDefault,
    reload: () => {
      setStatus("loading");
      setReload((r) => r + 1);
    },
  };
}
