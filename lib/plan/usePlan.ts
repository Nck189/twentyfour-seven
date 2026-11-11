"use client";

import type { SubSlot } from "@/lib/engine/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BlockKey, BlockSetting, ChecklistItem } from "@/content/blocks";
import type { FixedEvent } from "@/content/defaults";
import { hostFor, parseHHMM } from "@/lib/engine";
import { addDays, zonedInstant } from "@/lib/time";
import { logEvent } from "@/lib/db/events";
import { keepPending, markDirty, requeue, saveDirty, type DirtyDay } from "./patch";
import { getSupabase } from "@/lib/supabase/client";
import { currentDayDate, planFor, plannedWake, type DayContext, type DayPlanRow } from "@/lib/today/day";
import { DAY_PLAN_COLUMNS, emptyDayPlan, loadDayContext } from "@/lib/today/loadContext";
import { QUIET_RETRY_MS } from "@/lib/supabase/fetchWithTimeout";

export type DayPatch = Partial<Omit<DayPlanRow, "date" | "overrides">> & {
  /** Merged into overrides.blocks[key]. */
  block?: {
    key: BlockKey;
    first10?: string | null;
    checklist?: ChecklistItem[];
    duration_min?: number;
    /** Floating items in the block, e.g. a planned workout (SPEC §6). */
    sub_slots?: SubSlot[];
  };
  /** Adds one one-off fixed event (an appointment) to this day. */
  add_event?: FixedEvent;
  /** Removes one fixed event by id. */
  remove_event?: string;
};

const SAVE_DELAY_MS = 400;

/** Pure: applies a patch to a day plan row (templates are never touched). */
export function applyDayPatch(row: DayPlanRow, patch: DayPatch): DayPlanRow {
  const { block, add_event, remove_event, ...fields } = patch;
  const next: DayPlanRow = { ...row, ...fields, overrides: { ...row.overrides } };
  if (add_event || remove_event) {
    const events = (row.overrides.fixed_events ?? []).filter((e) => e.id !== remove_event);
    next.overrides.fixed_events =
      add_event && !events.some((e) => e.id === add_event.id) ? [...events, add_event] : events;
  }
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
  /** Per day, only the fields changed since the last successful save (R-M3-4). */
  const dirty = useRef<Record<string, DirtyDay>>({});
  /** Days with a save in flight (a realtime echo mustn't overwrite the newer local copy). */
  const inflight = useRef<Set<string>>(new Set());
  const ctxRef = useRef<DayContext | null>(null);
  const autoRetried = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadDayContext(client, -2, 14)
      .then(async (r) => {
        // Any day can be planned (month view): load every saved day beyond the window too, so a
        // far day never shows defaults and an edit there never drops what was saved (R2-6).
        const later = await client
          .from("day_plans")
          .select(DAY_PLAN_COLUMNS)
          .gt("date", addDays(r.today, 14));
        if (later.error) throw later.error;
        for (const row of (later.data ?? []) as DayPlanRow[]) r.ctx.dayPlans[row.date] = row;
        if (cancelled) return;
        // A reload (back from sleep) keeps days edited while it was in flight (R4-2).
        const local = ctxRef.current?.dayPlans;
        if (local)
          r.ctx.dayPlans = keepPending(
            r.ctx.dayPlans,
            local,
            (d) =>
              !!dirty.current[d] || !!timers.current[d] || inflight.current.has(d) || failed.current.has(d),
          );
        ctxRef.current = r.ctx;
        setCtx(r.ctx);
        setUserId(r.userId);
        // "Today" is the wake-day (a day runs wake → next wake): after midnight, before bed, Plan
        // and the Night ritual agree on what "tomorrow" is (R-M4-6).
        setToday(currentDayDate(r.ctx, new Date()));
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        // One quiet retry (a hung or dropped request), then the error with Try again.
        if (!autoRetried.current) {
          autoRetried.current = true;
          setTimeout(() => setReload((r) => r + 1), QUIET_RETRY_MS);
        } else setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [client, reload]);

  // Another device or screen changed a day: take its row unless this screen has unsaved edits
  // for that day (those are merged on the server when they save) (R2-5).
  useEffect(() => {
    if (!userId) return;
    const channel = client
      .channel(`plan-${userId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "day_plans", filter: `user_id=eq.${userId}` },
        (p) => {
          const row = p.new as DayPlanRow | undefined;
          const current = ctxRef.current;
          if (!row?.date || !current) return;
          if (dirty.current[row.date] || timers.current[row.date] || inflight.current.has(row.date)) return;
          const fresh: DayPlanRow = {
            date: row.date,
            template_id: row.template_id,
            attending: row.attending,
            bedtime_override: row.bedtime_override,
            late_night: row.late_night,
            mode: row.mode,
            overrides: row.overrides ?? {},
          };
          const next = { ...current, dayPlans: { ...current.dayPlans, [row.date]: fresh } };
          ctxRef.current = next;
          setCtx(next);
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, userId]);

  // Back after a while (the device slept, realtime missed events): reload, unless edits are
  // waiting to be saved (R3-2).
  useEffect(() => {
    let hiddenAt = 0;
    const onVisible = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      const busy =
        Object.keys(dirty.current).length || Object.keys(timers.current).length || inflight.current.size;
      if (hiddenAt && Date.now() - hiddenAt >= 60_000 && !busy) setReload((r) => r + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const persist = useCallback(
    async (date: string) => {
      const row = ctxRef.current?.dayPlans[date];
      const pending = dirty.current[date];
      delete timers.current[date]; // the timer fired (or was flushed): live updates resume (R3-2)
      if (!row || !userId) return false;
      if (!pending) return true;
      // Take what's pending; edits made while this save is in flight queue up separately.
      delete dirty.current[date];
      inflight.current.add(date);
      setSaving("saving");
      const change = { ...pending, set: { ...pending.set } };
      // The planned wake goes along only when this edit can move it, so a stale screen elsewhere
      // can't reset a push made on another device (R2-5).
      const movesWake =
        ["bedtime_override", "late_night", "template_id", "attending"].some((k) => k in pending.set) ||
        Boolean(pending.addEvents?.length || pending.removeEventIds?.length);
      if (movesWake) {
        try {
          change.set.planned = plannedWake(ctxRef.current!, date); // so the server honors a planned push
        } catch {
          // No kind of day: the server falls back to its own target.
        }
      }
      const ok = await saveDirty(client, userId, date, change, row);
      inflight.current.delete(date);
      if (ok) failed.current.delete(date);
      else {
        failed.current.add(date);
        dirty.current[date] = requeue(pending, dirty.current[date]);
      }
      setSaving(ok ? "saved" : "error");
      if (ok) void logEvent("day_planned", { date });
      return ok;
    },
    [client, userId],
  );

  const updateDay = useCallback(
    (date: string, patch: DayPatch) => {
      const current = ctxRef.current;
      if (!current) return;
      const row = applyDayPatch(current.dayPlans[date] ?? emptyDayPlan(date), patch);
      const next = { ...current, dayPlans: { ...current.dayPlans, [date]: row } };
      dirty.current[date] = markDirty(dirty.current[date], patch, row);
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
      updateDay(date, {
        add_event: { id: crypto.randomUUID(), key: "appointment", title, start, end, host },
      });
      await flush();
      void logEvent("appointment_added", { date, host });
    },
    [flush, updateDay],
  );

  const removeAppointment = useCallback(
    async (date: string, id: string) => {
      updateDay(date, { remove_event: id });
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
