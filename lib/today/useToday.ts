"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BlockKey, BlockSetting } from "@/content/blocks";
import { logEvent } from "@/lib/db/events";
import { getSupabase } from "@/lib/supabase/client";
import { addDays, DEFAULT_TZ, localDate } from "@/lib/time";
import {
  currentDayDate,
  isPastBlock,
  timelineFor,
  type DayContext,
  type DayPlanRow,
  type TemplateRow,
  type TimelineBlock,
} from "./day";

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
  const [wake, setWake] = useState<WakeEvent | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [saveError, setSaveError] = useState<(() => Promise<void>) | null>(null);
  const [reload, setReload] = useState(0);

  // --- Load -----------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: auth } = await client.auth.getUser();
        if (!auth.user) throw new Error("signed out");
        const [profile, settings, templates] = await Promise.all([
          client.from("profiles").select("timezone").eq("user_id", auth.user.id).maybeSingle(),
          client.from("settings").select("blocks, gym_close_time").eq("user_id", auth.user.id).single(),
          client.from("templates").select("*").order("sort"),
        ]);
        if (settings.error || templates.error) throw settings.error ?? templates.error;
        const timezone = (profile.data?.timezone as string | undefined) ?? DEFAULT_TZ;
        const today = localDate(new Date(), timezone);
        const plans = await client
          .from("day_plans")
          .select("date, template_id, attending, bedtime_override, late_night, mode, overrides")
          .gte("date", addDays(today, -2))
          .lte("date", addDays(today, 3));
        if (plans.error) throw plans.error;
        const ctx: DayContext = {
          timezone,
          blocks: settings.data.blocks as BlockSetting[],
          templates: templates.data as TemplateRow[],
          dayPlans: Object.fromEntries((plans.data as DayPlanRow[]).map((p) => [p.date, p])),
          gymClose: (settings.data.gym_close_time as string).slice(0, 5),
        };
        const [blockLogs, wakeRows] = await Promise.all([
          client.from("block_logs").select("*").gte("date", addDays(today, -1)).lte("date", today),
          client
            .from("wake_events")
            .select("date, target_wake, pressed_at, in_window, backfilled")
            .gte("date", addDays(today, -1)),
        ]);
        if (cancelled) return;
        setLoaded({ ctx, userId: auth.user.id });
        setLogs(
          Object.fromEntries(((blockLogs.data ?? []) as BlockLog[]).map((l) => [`${l.date}:${l.block}`, l])),
        );
        const dayDate = currentDayDate(ctx, new Date());
        setWake(((wakeRows.data ?? []) as WakeEvent[]).find((w) => w.date === dayDate) ?? null);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, reload]);

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
          if (row?.block) setLogs((prev) => ({ ...prev, [`${row.date}:${row.block}`]: row }));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wake_events", filter: `user_id=eq.${userId}` },
        (p) => {
          const row = p.new as WakeEvent;
          if (row?.date) setWake((prev) => prev ?? row);
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, userId]);

  // --- Derived ----------------------------------------------------------------------------
  const dayDate = useMemo(() => (loaded ? currentDayDate(loaded.ctx, now) : null), [loaded, now]);
  const timeline = useMemo(
    () => (loaded && dayDate ? timelineFor(loaded.ctx, dayDate) : null),
    [loaded, dayDate],
  );
  const logFor = useCallback(
    (b: TimelineBlock) => logs[`${b.logDate}:${b.key}`] ?? emptyLog(b.logDate, b.key),
    [logs],
  );

  // --- Optimistic write helper -----------------------------------------------------------
  const logsRef = useRef(logs);
  const seqRef = useRef<Record<string, number>>({});
  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  const mutate = useCallback(
    async (
      key: string,
      next: BlockLog,
      save: () => PromiseLike<{ data: unknown; error: unknown }>,
      event: [string, Record<string, unknown>],
    ) => {
      const before = logsRef.current[key];
      // Keep logsRef current immediately so a quick second tap builds on this change.
      logsRef.current = { ...logsRef.current, [key]: next };
      setLogs((prev) => ({ ...prev, [key]: next }));
      setSaveError(null);
      const seq = (seqRef.current[key] ?? 0) + 1;
      seqRef.current[key] = seq;
      const run = async () => {
        const { data, error } = await save();
        if (error) throw error;
        // Only the newest request may overwrite local state (responses can arrive out of order).
        if (seqRef.current[key] === seq && data && typeof data === "object" && "block" in (data as object)) {
          const saved = data as BlockLog;
          setLogs((prev) => ({ ...prev, [key]: saved }));
        }
        void logEvent(event[0], event[1]);
      };
      try {
        await run();
      } catch {
        setLogs((prev) => {
          const copy = { ...prev };
          if (before) copy[key] = before;
          else delete copy[key];
          return copy;
        });
        setSaveError(() => async () => {
          setLogs((prev) => ({ ...prev, [key]: next }));
          try {
            await run();
            setSaveError(null);
          } catch {
            setLogs((prev) => {
              const copy = { ...prev };
              if (before) copy[key] = before;
              else delete copy[key];
              return copy;
            });
          }
        });
      }
    },
    [],
  );

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
      };
      const row = {
        user_id: loaded.userId,
        date: next.date,
        block: next.block,
        planned_start: next.planned_start,
        started_at: next.started_at,
        first10_at: next.first10_at,
        closed_at: next.closed_at,
        items_planned: next.items_planned,
        mood: next.mood,
        energy: next.energy,
        location: next.location,
        backfilled: past || next.backfilled,
      };
      return mutate(
        key,
        { ...next, backfilled: row.backfilled },
        () => client.from("block_logs").upsert(row, { onConflict: "user_id,date,block" }).select().single(),
        [event, { date: next.date, block: next.block, backfilled: row.backfilled }],
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
      setLocation: (b: TimelineBlock, location: "home" | "out", at: Date) =>
        upsertLog(b, { location }, "location_set", at),
      pressWake: async () => {
        const { data, error } = await client.rpc("press_wake");
        if (error) throw error;
        setWake(data as WakeEvent);
        return data as WakeEvent;
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
    timeline,
    dayDate,
    timezone: loaded?.ctx.timezone ?? DEFAULT_TZ,
    logFor,
    wake,
    actions,
    saveError,
    retrySave: saveError,
    dismissError: () => setSaveError(null),
    reload: () => setReload((r) => r + 1),
  };
}
