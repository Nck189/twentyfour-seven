"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BlockKey } from "@/content/blocks";
import { logEvent } from "@/lib/db/events";
import { saveDirty } from "@/lib/plan/patch";
import { getSupabase } from "@/lib/supabase/client";
import { addDays, DEFAULT_TZ } from "@/lib/time";

import {
  currentDayDate,
  isPastBlock,
  pickWakeCard,
  timelineFor,
  type DayContext,
  type DayPlanRow,
  type TimelineBlock,
} from "./day";
import { sameDayContext, shouldRefreshOnForeground } from "./foreground";
import { loadDayContext } from "./loadContext";
import { QUIET_RETRY_MS } from "@/lib/supabase/fetchWithTimeout";

export type BlockLog = {
  id?: string;
  date: string;
  block: BlockKey;
  planned_start: string | null;
  started_at: string | null;
  first10_at: string | null;
  closed_at: string | null;
  items_done: string[];
  items_planned: number;
  mood: number | null;
  energy: number | null;
  location: "home" | "out" | null;
  backfilled: boolean;
  miss_reason: string | null;
  updated_at?: string;
};

export type WakeEvent = {
  date: string;
  target_wake: string;
  pressed_at: string;
  in_window: boolean;
  backfilled: boolean;
};

type Loaded = { ctx: DayContext; userId: string };

const emptyLog = (date: string, block: BlockKey): BlockLog => ({
  date,
  block,
  planned_start: null,
  started_at: null,
  first10_at: null,
  closed_at: null,
  items_done: [],
  items_planned: 0,
  mood: null,
  energy: null,
  location: null,
  backfilled: false,
  miss_reason: null,
});

/**
 * Loads everything the Today screen needs and exposes check-in actions.
 * Writes are optimistic: the UI updates at once and rolls back with an error if the save fails.
 */
export function useToday(now: Date) {
  const client = getSupabase();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [logs, setLogs] = useState<Record<string, BlockLog>>({});
  const [wakes, setWakes] = useState<Record<string, WakeEvent>>({});
  const [frozen, setFrozen] = useState<Record<string, string>>({});
  const [nightDone, setNightDone] = useState<string[]>([]);
  const [nightDoneAtLoad, setNightDoneAtLoad] = useState<string[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [saveError, setSaveError] = useState(0);
  const [reload, setReload] = useState(0);
  const autoRetried = useRef(false);
  const loadedOnce = useRef(false);

  const logsRef = useRef<Record<string, BlockLog>>({});
  const serverRef = useRef<Record<string, BlockLog>>({});
  const seqRef = useRef<Record<string, number>>({});
  type Op = {
    key: string;
    next: BlockLog;
    save: () => PromiseLike<{ data: unknown; error: unknown }>;
    event: [string, Record<string, unknown>];
  };
  const queueRef = useRef<Op[]>([]);
  /** Saves currently in flight per block: a refetch must not overwrite those blocks. */
  const inflightRef = useRef<Record<string, number>>({});

  // --- Load -----------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { ctx, userId, today } = await loadDayContext(client);
        const [blockLogs, wakeRows, nightRows, snapRows] = await Promise.all([
          client.from("block_logs").select("*").gte("date", addDays(today, -1)).lte("date", today),
          client
            .from("wake_events")
            .select("date, target_wake, pressed_at, in_window, backfilled")
            .gte("date", addDays(today, -1)),
          client
            .from("ticket_grants")
            .select("ref_date")
            .eq("reason", "night")
            .gte("ref_date", addDays(today, -1)),
          // A target the server froze after a late edit is the one "I'm up" is judged by (R2-4).
          client.from("wake_snapshots").select("date, target_wake").gte("date", addDays(today, -1)),
        ]);
        if (cancelled) return;
        // Keep the same object when nothing changed, so actions and the timeline aren't rebuilt.
        setLoaded((prev) =>
          prev && prev.userId === userId && sameDayContext(prev.ctx, ctx) ? prev : { ctx, userId },
        );
        const loadedLogs = Object.fromEntries(
          ((blockLogs.data ?? []) as BlockLog[]).map((l) => [`${l.date}:${l.block}`, l]),
        );
        // A refetch (e.g. app back in the foreground) keeps blocks with pending local changes.
        const busy = (k: string) =>
          (inflightRef.current[k] ?? 0) > 0 || queueRef.current.some((o) => o.key === k);
        const merged: Record<string, BlockLog> = { ...loadedLogs };
        for (const [k, v] of Object.entries(logsRef.current)) if (busy(k)) merged[k] = v;
        for (const [k, v] of Object.entries(loadedLogs)) if (!busy(k)) serverRef.current[k] = v;
        logsRef.current = merged;
        setLogs(merged);
        setWakes(Object.fromEntries(((wakeRows.data ?? []) as WakeEvent[]).map((w) => [w.date, w])));
        setFrozen(
          Object.fromEntries(
            ((snapRows.data ?? []) as { date: string; target_wake: string }[]).map((r) => [
              r.date,
              r.target_wake,
            ]),
          ),
        );
        const doneDates = ((nightRows.data ?? []) as { ref_date: string }[]).map((r) => r.ref_date);
        setNightDone(doneDates);
        setNightDoneAtLoad(doneDates);
        loadedOnce.current = true;
        setStatus("ready");
      } catch {
        // A failed refetch (e.g. after a day-plan change elsewhere) keeps what's on screen; only a
        // failed first load shows the error card (an open Night ritual stays open).
        // A failed first load retries once quietly (like Plan and the backlog) before the card.
        if (cancelled) return;
        if (!loadedOnce.current && !autoRetried.current) {
          autoRetried.current = true;
          setTimeout(() => setReload((r) => r + 1), QUIET_RETRY_MS);
          return;
        }
        setStatus((st) => (st === "ready" ? st : "error"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, reload]);

  // Coming back to the app (iOS home-screen apps stay open for days): refresh silently,
  // but only after a real absence; a quick app switch must not re-render mid-tap (CJ-15).
  useEffect(() => {
    let hiddenAt: number | null = null;
    const onVisible = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (shouldRefreshOnForeground(hiddenAt, Date.now())) setReload((r) => r + 1);
      hiddenAt = null;
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // --- Live sync between devices (CJ-15) -------------------------------------------------
  const userId = loaded?.userId;
  useEffect(() => {
    if (!userId) return;
    const channel = client
      .channel(`today-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "block_logs", filter: `user_id=eq.${userId}` },
        (p) => {
          const row = p.new as BlockLog;
          if (!row?.block) return;
          const key = `${row.date}:${row.block}`;
          // Realtime events can arrive late: never let an older row replace a newer one.
          const known = serverRef.current[key]?.updated_at;
          if (known && row.updated_at && row.updated_at < known) return;
          serverRef.current[key] = row;
          // Don't overwrite a local change that's in flight or waiting to be retried.
          if (!queueRef.current.some((o) => o.key === key) && !(inflightRef.current[key] > 0)) {
            logsRef.current = { ...logsRef.current, [key]: row };
            setLogs(logsRef.current);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "day_plans", filter: `user_id=eq.${userId}` },
        // A day plan changed elsewhere (Plan, another device): refetch; unchanged data keeps the
        // same objects, and blocks with saves in flight keep their local state.
        () => setReload((r) => r + 1),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wake_events", filter: `user_id=eq.${userId}` },
        (p) => {
          const row = p.new as WakeEvent;
          if (row?.date) setWakes((prev) => ({ ...prev, [row.date]: row }));
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, userId]);

  // --- Derived ----------------------------------------------------------------------------
  // The pressed wake target first, then the server's frozen one (same order as `_wake_day`).
  const pinned = useMemo(
    () => ({ ...frozen, ...Object.fromEntries(Object.values(wakes).map((w) => [w.date, w.target_wake])) }),
    [wakes, frozen],
  );
  const dayDate = useMemo(
    () => (loaded ? currentDayDate(loaded.ctx, now, pinned) : null),
    [loaded, now, pinned],
  );
  const timeline = useMemo(
    () => (loaded && dayDate ? timelineFor(loaded.ctx, dayDate) : null),
    [loaded, dayDate],
  );
  /**
   * Which "I'm up" to show. Same rule as the server: the press belongs to the calendar date.
   * From 3 h before today's target the card is today's (button or result); before that it
   * shows the last result (e.g. yesterday's) and no button.
   */
  const wakeCard = useMemo(
    () => (loaded && dayDate ? pickWakeCard(loaded.ctx, now, dayDate, wakes, frozen) : null),
    [loaded, dayDate, now, wakes, frozen],
  );

  const logFor = useCallback(
    (b: TimelineBlock) => logs[`${b.logDate}:${b.key}`] ?? emptyLog(b.logDate, b.key),
    [logs],
  );

  // --- Optimistic writes with a retry queue ----------------------------------------------
  // logsRef: what the UI shows (updated immediately so quick taps build on each other).
  // serverRef: the last state the server confirmed (what a failed write rolls back to).
  // queueRef: every failed write, replayed in order by "Try again" (nothing is silently lost).
  const show = useCallback((key: string, row: BlockLog | undefined) => {
    const copy = { ...logsRef.current };
    if (row) copy[key] = row;
    else delete copy[key];
    logsRef.current = copy;
    setLogs(copy);
  }, []);

  const runOp = useCallback(async (op: Op) => {
    const seq = (seqRef.current[op.key] ?? 0) + 1;
    seqRef.current[op.key] = seq;
    inflightRef.current[op.key] = (inflightRef.current[op.key] ?? 0) + 1;
    let res: { data: unknown; error: unknown };
    try {
      res = await op.save();
    } finally {
      inflightRef.current[op.key] -= 1;
    }
    const { data, error } = res;
    if (error) throw error;
    if (data && typeof data === "object" && "block" in (data as object)) {
      const saved = data as BlockLog;
      serverRef.current[op.key] = saved;
      // Only the newest request may overwrite what's on screen (responses can arrive out of order).
      if (seqRef.current[op.key] === seq) {
        logsRef.current = { ...logsRef.current, [op.key]: saved };
        setLogs(logsRef.current);
      }
    }
    void logEvent(op.event[0], op.event[1]);
  }, []);

  const failQueue = useCallback(
    (ops: Op[]) => {
      queueRef.current = [...queueRef.current, ...ops];
      // Roll every affected block back to what the server last confirmed.
      for (const key of new Set(queueRef.current.map((o) => o.key))) show(key, serverRef.current[key]);
      setSaveError(queueRef.current.length);
    },
    [show],
  );

  const mutate = useCallback(
    async (key: string, next: BlockLog, save: Op["save"], event: Op["event"]) => {
      const op: Op = { key, next, save, event };
      show(key, next);
      if (queueRef.current.length) {
        // Earlier writes are still pending: keep order, wait for "Try again".
        failQueue([op]);
        return;
      }
      try {
        await runOp(op);
      } catch {
        failQueue([op]);
      }
    },
    [failQueue, runOp, show],
  );

  const retrySave = useCallback(async () => {
    const ops = queueRef.current;
    queueRef.current = [];
    setSaveError(0);
    for (let i = 0; i < ops.length; i++) {
      show(ops[i].key, ops[i].next);
      try {
        await runOp(ops[i]);
      } catch {
        failQueue(ops.slice(i));
        return;
      }
    }
  }, [failQueue, runOp, show]);

  // Back online: replay failed saves by itself (the "Try again" button stays as a fallback).
  useEffect(() => {
    const onOnline = () => {
      if (queueRef.current.length) void retrySave();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [retrySave]);

  const upsertLog = useCallback(
    (b: TimelineBlock, patch: Partial<BlockLog>, event: string, nowAt: Date) => {
      if (!loaded) return Promise.resolve();
      const key = `${b.logDate}:${b.key}`;
      const current = logsRef.current[key] ?? emptyLog(b.logDate, b.key);
      const past = isPastBlock(b, nowAt);
      // Starting implicitly: live = now; a past block is backfilled at its planned start.
      const startedAt = current.started_at ?? (past ? b.start.toISOString() : nowAt.toISOString());
      const next: BlockLog = {
        ...current,
        planned_start: current.planned_start ?? b.start.toISOString(),
        items_planned: Math.max(current.items_planned, b.checklist.length),
        started_at: startedAt,
        ...patch,
        backfilled: current.backfilled || past,
      };
      // Field-level: send only identity + what this action changes, so another device's edits survive.
      const row: Record<string, unknown> = {
        user_id: loaded.userId,
        date: next.date,
        block: next.block,
        planned_start: next.planned_start,
        items_planned: next.items_planned,
        ...patch,
      };
      if (!current.started_at) row.started_at = startedAt;
      if (past) row.backfilled = true;
      return mutate(
        key,
        next,
        () => client.from("block_logs").upsert(row, { onConflict: "user_id,date,block" }).select().single(),
        [event, { date: next.date, block: next.block, backfilled: next.backfilled }],
      );
    },
    [client, loaded, mutate],
  );

  // --- Actions ----------------------------------------------------------------------------
  const actions = useMemo(
    () => ({
      start: (b: TimelineBlock, at: Date) => upsertLog(b, {}, "block_started", at),
      toggleFirst10: (b: TimelineBlock, at: Date) => {
        const cur = logFor(b);
        const past = isPastBlock(b, at);
        return upsertLog(
          b,
          { first10_at: cur.first10_at ? null : past ? b.start.toISOString() : at.toISOString() },
          cur.first10_at ? "first10_undone" : "first10_done",
          at,
        );
      },
      toggleItem: (b: TimelineBlock, itemId: string, at: Date) => {
        if (!loaded) return Promise.resolve();
        const key = `${b.logDate}:${b.key}`;
        const cur = logFor(b);
        const done = !cur.items_done.includes(itemId);
        const past = isPastBlock(b, at);
        const next: BlockLog = {
          ...cur,
          planned_start: cur.planned_start ?? b.start.toISOString(),
          started_at: cur.started_at ?? (past ? b.start.toISOString() : at.toISOString()),
          items_planned: Math.max(cur.items_planned, b.checklist.length),
          items_done: done ? [...cur.items_done, itemId] : cur.items_done.filter((x) => x !== itemId),
          backfilled: cur.backfilled || past,
        };
        const save = async () => {
          if (past && !cur.started_at) {
            // Create the backfilled log first (planned start), then toggle atomically.
            const first = await client.from("block_logs").upsert(
              {
                user_id: loaded.userId,
                date: b.logDate,
                block: b.key,
                planned_start: next.planned_start,
                started_at: next.started_at,
                items_planned: next.items_planned,
                backfilled: true,
              },
              { onConflict: "user_id,date,block" },
            );
            if (first.error) return first;
          }
          return client.rpc("set_block_item", {
            p_date: b.logDate,
            p_block: b.key,
            p_item: itemId,
            p_done: done,
            p_planned_start: next.planned_start,
            p_items_planned: next.items_planned,
          });
        };
        return mutate(key, next, () => save(), [
          done ? "item_done" : "item_undone",
          { date: b.logDate, block: b.key, item: itemId },
        ]);
      },
      close: (b: TimelineBlock, at: Date) =>
        upsertLog(
          b,
          { closed_at: isPastBlock(b, at) ? b.end.toISOString() : at.toISOString() },
          "block_closed",
          at,
        ),
      rate: (b: TimelineBlock, at: Date, mood: number | null, energy: number | null) =>
        upsertLog(b, { mood, energy }, "block_rated", at),
      reopen: (b: TimelineBlock, at: Date) => upsertLog(b, { closed_at: null }, "block_reopened", at),
      /** Night ritual "close today": a block that didn't happen gets a reason (never marked started). */
      markMissed: (b: TimelineBlock, reason: string) => {
        if (!loaded) return Promise.resolve();
        const key = `${b.logDate}:${b.key}`;
        const cur = logsRef.current[key] ?? emptyLog(b.logDate, b.key);
        const next: BlockLog = {
          ...cur,
          planned_start: cur.planned_start ?? b.start.toISOString(),
          items_planned: Math.max(cur.items_planned, b.checklist.length),
          miss_reason: reason,
          closed_at: cur.closed_at ?? b.end.toISOString(),
          backfilled: true,
        };
        return mutate(
          key,
          next,
          () =>
            client
              .from("block_logs")
              .upsert(
                {
                  user_id: loaded.userId,
                  date: b.logDate,
                  block: b.key,
                  planned_start: next.planned_start,
                  items_planned: next.items_planned,
                  miss_reason: reason,
                  closed_at: next.closed_at,
                  backfilled: true,
                },
                { onConflict: "user_id,date,block" },
              )
              .select()
              .single(),
          ["block_missed", { date: b.logDate, block: b.key, reason }],
        );
      },
      completeNightRitual: async () => {
        if (!dayDate) return { ticket_granted: false };
        const { data, error } = await client.rpc("complete_night_ritual", { p_date: dayDate });
        if (error) throw error;
        setNightDone((prev) => [...prev, dayDate]);
        return data as { ticket_granted: boolean; in_time?: boolean };
      },
      /**
       * Goodnight = going to bed (lib/today/bedtime goodnightSleep decides whether, G7 R-M10-R3-1):
       * starts Sleep now if it isn't, and ticks its first-10 when asked.
       */
      goToBed: (b: TimelineBlock, at: Date, first10: boolean) => {
        const cur = logFor(b);
        const patch = first10 && !cur.first10_at ? { first10_at: at.toISOString() } : {};
        return upsertLog(b, patch, cur.started_at ? "first10_done" : "block_started", at);
      },
      setLocation: (b: TimelineBlock, location: "home" | "out", at: Date) =>
        upsertLog(b, { location }, "location_set", at),
      pressWake: async () => {
        const { data, error } = await client.rpc("press_wake");
        if (error) throw error;
        const w = data as WakeEvent;
        setWakes((prev) => ({ ...prev, [w.date]: w }));
        return data as WakeEvent;
      },
      /** Picks today's first-10 for a block (a per-day override; the default stays as set). */
      setFirst10: async (b: TimelineBlock, value: string | null) => {
        if (!loaded) return;
        const row = loaded.ctx.dayPlans[b.logDate];
        const blocks = row?.overrides.blocks ?? {};
        const block = { ...blocks[b.key], first10: value };
        // Only this block's override: other blocks, the mode, the bedtime stay as saved (R-M3-4).
        const ok = await saveDirty(
          client,
          loaded.userId,
          b.logDate,
          { set: {}, blocks: { [b.key]: block } },
          row && { ...row, overrides: { ...row.overrides, blocks: { ...blocks, [b.key]: block } } },
        );
        if (!ok) throw new Error("first-10 not saved");
        void logEvent("first10_changed", { date: b.logDate, block: b.key });
        setReload((r) => r + 1);
      },
      setMode: async (mode: DayPlanRow["mode"]) => {
        if (!loaded || !dayDate) return;
        const { error } = await client
          .from("day_plans")
          .upsert({ user_id: loaded.userId, date: dayDate, mode }, { onConflict: "user_id,date" });
        if (error) throw error;
        void logEvent("mode_set", { date: dayDate, mode });
        setReload((r) => r + 1);
      },
    }),
    [client, dayDate, loaded, logFor, mutate, upsertLog],
  );

  return {
    status,
    /** The user's block settings (own first-10 choices live here). */
    blockSettings: loaded?.ctx.blocks ?? [],
    timeline,
    dayDate,
    timezone: loaded?.ctx.timezone ?? DEFAULT_TZ,
    logFor,
    wakeCard,
    nightDone: dayDate ? nightDone.includes(dayDate) : false,
    /** As loaded (not flipped by finishing the ritual), so an open ritual sheet stays open. */
    nightDoneAtLoad: dayDate ? nightDoneAtLoad.includes(dayDate) : false,
    actions,
    saveError,
    retrySave,
    reload: () => setReload((r) => r + 1),
  };
}
