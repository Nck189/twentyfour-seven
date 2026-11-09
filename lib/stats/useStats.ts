"use client";

import { useCallback, useEffect, useState } from "react";
import type { DayFacts, DayMode } from "@/lib/game";
import { buildDayFacts, type LogRow } from "@/lib/game/facts";
import { statsFrom, type ImrPoint, type SleepDay } from "@/lib/stats/stats";
import { getSupabase } from "@/lib/supabase/client";
import { addDays, localDate, localParts } from "@/lib/time";
import { currentDayDate } from "@/lib/today/day";
import { loadDayContext } from "@/lib/today/loadContext";

/** How far back Stats look (finished wake-days only). */
export const STATS_DAYS = 28;

export type ReviewStatus = { week_start: string | null; done: boolean };
export type StatsData = {
  today: string;
  /** Finished wake-days, oldest first. */
  days: DayFacts[];
  /** Live "I'm up" presses (minutes after local midnight). */
  wakes: ImrPoint[];
  /** Bed = when the Night ritual was done in time (minutes after local noon), wake = the press. */
  sleep: SleepDay[];
  /** Null before the M10 migration is on the server. */
  review: ReviewStatus | null;
};

const minutes = (iso: string, tz: string) => {
  const p = localParts(new Date(iso), tz);
  return p.hour * 60 + p.minute;
};

/** Stats (SPEC §7): the last few weeks of finished days, computed by lib/stats. */
export function useStats() {
  const client = getSupabase();
  const [data, setData] = useState<StatsData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { ctx } = await loadDayContext(client, -1, 1);
        const today = currentDayDate(ctx, new Date());
        const from = addDays(today, -STATS_DAYS);
        const last = addDays(today, -1);
        const [logs, plans, wakes, nights, review, profile, rituals] = await Promise.all([
          client.from("block_logs").select("*").gte("date", from).lte("date", last),
          // Up to today: today's plan may hold last night's Out late (it excuses yesterday's Free).
          client.from("day_plans").select("date, mode, late_night").gte("date", from).lte("date", today),
          client
            .from("wake_events")
            .select("date, pressed_at, in_window, backfilled")
            .gte("date", from)
            .lte("date", last)
            .order("date"),
          client.from("ticket_grants").select("ref_date").eq("reason", "night").gte("ref_date", from),
          client.rpc("weekly_review_status"),
          client.from("profiles").select("created_at").maybeSingle(),
          // Bedtime = when the Night ritual was done (Sleep itself has no check-in on Today).
          client
            .from("events")
            .select("payload, at")
            .eq("type", "night_ritual_completed")
            .gte("at", `${addDays(from, -1)}T00:00:00Z`)
            .order("at"),
        ]);
        // A failed profile read would silently bring back the pre-sign-up days (R-M10-R7).
        const err =
          logs.error ?? plans.error ?? wakes.error ?? nights.error ?? rituals.error ?? profile.error;
        if (err) throw err;
        const tz = ctx.timezone;
        const planRows = plans.data as { date: string; mode: DayMode; late_night: unknown }[];
        // Built up to today (its blocks are open), then today is left out: finished days only.
        const days = buildDayFacts({
          from,
          today,
          timezone: tz,
          logs: logs.data as LogRow[],
          lateNights: planRows.filter((p) => p.late_night).map((p) => p.date),
          modes: Object.fromEntries(planRows.map((p) => [p.date, p.mode])),
          wakes: wakes.data as { date: string; in_window: boolean; backfilled: boolean }[],
          nights: (nights.data as { ref_date: string }[]).map((n) => n.ref_date),
          exercise: [],
        }).filter((d) => d.date < today);
        // Never before the account existed (G7 R-M10-1): those days would read as all missed.
        const created = (profile.data as { created_at?: string } | null)?.created_at;
        const createdOn = created ? localDate(new Date(created), tz) : null;
        const start = statsFrom(
          today,
          createdOn,
          !!createdOn && (wakes.data as { date: string }[]).some((w) => w.date === createdOn),
          STATS_DAYS,
        );
        const shown = days.filter((d) => d.date >= start);
        const liveWakes = (wakes.data as { date: string; pressed_at: string; backfilled: boolean }[]).filter(
          (w) => !w.backfilled,
        );
        const wakeBy = new Map(liveWakes.map((w) => [w.date, minutes(w.pressed_at, tz)]));
        const bedBy = new Map<string, number>();
        for (const r of rituals.data as { payload: { date?: string; in_time?: boolean }; at: string }[]) {
          // The first in-time ritual of each night (the one that earned the Night ticket).
          const d = r.payload?.date;
          if (d && r.payload.in_time && !bedBy.has(d)) bedBy.set(d, (minutes(r.at, tz) - 720 + 1440) % 1440);
        }
        const sleep: SleepDay[] = shown.map((d) => ({
          date: d.date,
          // Bed on day d is the night before d + 1's wake.
          bed: bedBy.get(d.date) ?? null,
          wake: wakeBy.get(d.date) ?? null,
        }));
        if (cancelled) return;
        setData({
          today,
          days: shown,
          wakes: liveWakes
            .filter((w) => w.date >= start)
            .map((w) => ({ date: w.date, value: wakeBy.get(w.date)! })),
          sleep,
          review: review.error ? null : (review.data as ReviewStatus),
        });
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, reload]);

  const submitReview = useCallback(
    async (keep: string, problem: string, tryNext: string) => {
      const { data: r, error } = await client.rpc("submit_weekly_review", {
        p_keep: keep,
        p_problem: problem,
        p_try: tryNext,
      });
      if (error) throw error;
      setData((d) => (d && d.review ? { ...d, review: { ...d.review, done: true } } : d));
      return r as { week_start: string; granted: boolean };
    },
    [client],
  );

  return { data, status, retry: () => setReload((n) => n + 1), submitReview };
}
