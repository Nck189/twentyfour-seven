/**
 * Stats (SPEC §7): pure functions over the same day facts the farm uses (lib/game). No I/O.
 * Times are minutes: wake = minutes after local midnight; bed = minutes after local noon, so a
 * bedtime around midnight doesn't wrap (23:00 → 660, 01:00 → 780).
 */
import { BLOCK_KEYS, type BlockKey } from "@/content/blocks";
import { blockResult, dayOee, isMinimumDay, isPerfectDay, type DayFacts } from "@/lib/game/outcome";
import { addDays, isoWeekday } from "@/lib/time";

/**
 * Blocks Stats judge: those checked in at least once in the window. A block never used (e.g.
 * Sleep, which only the full-day list lets you check in) would otherwise read as missed every
 * day and always be the "needs love" block (G7 R-M10-7).
 */
export function usedBlocks(days: readonly DayFacts[]): BlockKey[] {
  return BLOCK_KEYS.filter((b) => days.some((d) => d.logs[b]));
}

/**
 * First wake-day Stats look at (G7 R-M10-1): never before the account existed. Like the streak's
 * settle, the sign-up day counts only if it had a wake; at most `days` back from today.
 */
export function statsFrom(
  today: string,
  createdOn: string | null,
  wakeOnCreatedDay: boolean,
  days = 28,
): string {
  const earliest = addDays(today, -days);
  if (!createdOn) return earliest;
  const first = wakeOnCreatedDay ? createdOn : addDays(createdOn, 1);
  return first > earliest ? first : earliest;
}

// ---------- I-MR control chart (wake times) ----------

export type ImrPoint = { date: string; value: number };
export type ImrChart = {
  points: (ImrPoint & { mr: number | null; out: boolean })[];
  mean: number;
  /** Average moving range. */
  mrBar: number;
  /** σ estimated from the moving range (MR̄ / d2, d2 = 1.128 for n = 2). */
  sigma: number;
  ucl: number;
  lcl: number;
};

/** Individuals + moving-range chart: mean ± 3σ, points outside flagged. Null under 2 points. */
export function imrChart(points: readonly ImrPoint[]): ImrChart | null {
  if (points.length < 2) return null;
  const values = points.map((p) => p.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const mrs = values.slice(1).map((v, i) => Math.abs(v - values[i]!));
  const mrBar = mrs.reduce((a, b) => a + b, 0) / mrs.length;
  const sigma = mrBar / 1.128;
  const ucl = mean + 3 * sigma;
  const lcl = mean - 3 * sigma;
  return {
    points: points.map((p, i) => ({
      ...p,
      mr: i === 0 ? null : mrs[i - 1]!,
      out: sigma > 0 && (p.value > ucl || p.value < lcl),
    })),
    mean,
    mrBar,
    sigma,
    ucl,
    lcl,
  };
}

/** Splits wake points into weekdays (Mon–Fri) and the weekend (Sat–Sun), as SPEC §7 asks. */
export function splitWeekend(points: readonly ImrPoint[]): { weekday: ImrPoint[]; weekend: ImrPoint[] } {
  const weekday: ImrPoint[] = [];
  const weekend: ImrPoint[] = [];
  for (const p of points) (isoWeekday(p.date) >= 6 ? weekend : weekday).push(p);
  return { weekday, weekend };
}

// ---------- sleep regularity ----------

export type SleepDay = { date: string; bed: number | null; wake: number | null };
export type Regularity = {
  /** SD of bedtimes / wake times over the last `window` days with data (minutes), null if < 2. */
  bedSd: number | null;
  wakeSd: number | null;
  /** Least-squares slope of wake time over those days (minutes per day; + = getting later). */
  wakeDrift: number | null;
};

function sd(xs: readonly number[]): number | null {
  if (xs.length < 2) return null;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

function slope(xs: readonly number[]): number | null {
  if (xs.length < 2) return null;
  const n = xs.length;
  const mx = (n - 1) / 2;
  const my = xs.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  xs.forEach((y, x) => {
    num += (x - mx) * (y - my);
    den += (x - mx) ** 2;
  });
  return den === 0 ? 0 : num / den;
}

/** Sleep regularity over the last `window` days (SPEC §7: rolling 7). Days in date order. */
export function sleepRegularity(days: readonly SleepDay[], window = 7): Regularity {
  const last = days.slice(-window);
  const beds = last.flatMap((d) => (d.bed === null ? [] : [d.bed]));
  const wakes = last.flatMap((d) => (d.wake === null ? [] : [d.wake]));
  return { bedSd: sd(beds), wakeSd: sd(wakes), wakeDrift: slope(wakes) };
}

// ---------- heatmap, Pareto, home vs out ----------

export type Cell = { success: number; judged: number };
/** block × ISO weekday (1 = Mon … 7 = Sun) → success / judged (success + partial + miss). */
export type Heatmap = Record<BlockKey, Record<number, Cell>>;

export function heatmap(days: readonly DayFacts[]): Heatmap {
  const used = usedBlocks(days);
  const out = Object.fromEntries(
    BLOCK_KEYS.map((b) => [
      b,
      Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((w) => [w, { success: 0, judged: 0 }])),
    ]),
  ) as Heatmap;
  for (const d of days) {
    const w = isoWeekday(d.date);
    for (const b of used) {
      const r = blockResult(d, b);
      if (r !== "success" && r !== "partial" && r !== "miss") continue;
      out[b][w]!.judged++;
      if (r === "success") out[b][w]!.success++;
    }
  }
  return out;
}

export type ParetoRow = { reason: string; count: number; share: number; cumulative: number };

/** Miss reasons, most frequent first, with each one's share and the running total (0–1). */
export function pareto(days: readonly DayFacts[]): ParetoRow[] {
  const counts = new Map<string, number>();
  for (const d of days) {
    for (const b of BLOCK_KEYS) {
      const reason = d.logs[b]?.miss_reason;
      if (reason && blockResult(d, b) === "miss") counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  let run = 0;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([reason, count]) => {
      run += count;
      return { reason, count, share: count / total, cumulative: run / total };
    });
}

export type PlaceRate = { done: number; logged: number; rate: number | null };

/** Completion at home vs out (SPEC §7): blocks done (success or partial) / blocks checked in there. */
export function homeVsOut(days: readonly DayFacts[]): { home: PlaceRate; out: PlaceRate } {
  const acc = { home: { done: 0, logged: 0 }, out: { done: 0, logged: 0 } };
  for (const d of days) {
    for (const b of BLOCK_KEYS) {
      const log = d.logs[b];
      const where = log?.location;
      if (!where) continue;
      const r = blockResult(d, b);
      if (r !== "success" && r !== "partial" && r !== "miss") continue;
      acc[where].logged++;
      if (r !== "miss") acc[where].done++;
    }
  }
  const rate = (p: { done: number; logged: number }): PlaceRate => ({
    ...p,
    rate: p.logged > 0 ? p.done / p.logged : null,
  });
  return { home: rate(acc.home), out: rate(acc.out) };
}

// ---------- week summary ----------

export type WeekSummary = {
  days: number;
  /** Mean Day OEE over normal days that have one, null if none. */
  avgOee: number | null;
  minimumDays: number;
  perfectDays: number;
  /** Block with the best / worst success rate this week (at least 2 judged days), or null. */
  bestBlock: BlockKey | null;
  worstBlock: BlockKey | null;
};

export function weekSummary(days: readonly DayFacts[]): WeekSummary {
  const oees = days.flatMap((d) => {
    const o = dayOee(d);
    return o ? [o.oee] : [];
  });
  const rates = usedBlocks(days).flatMap((b) => {
    let success = 0;
    let judged = 0;
    for (const d of days) {
      const r = blockResult(d, b);
      if (r !== "success" && r !== "partial" && r !== "miss") continue;
      judged++;
      if (r === "success") success++;
    }
    return judged >= 2 ? [{ b, rate: success / judged }] : [];
  });
  // Stable sorts: ties go to the earlier block of the day.
  const best = [...rates].sort((x, y) => y.rate - x.rate);
  const worst = [...rates].sort((x, y) => x.rate - y.rate);
  return {
    days: days.length,
    avgOee: oees.length ? oees.reduce((a, b) => a + b, 0) / oees.length : null,
    minimumDays: days.filter(isMinimumDay).length,
    perfectDays: days.filter(isPerfectDay).length,
    bestBlock: best[0]?.b ?? null,
    // Only when it really is worse than the best (all equal → no "needs love", R-M10-2).
    worstBlock: worst.length > 1 && worst[0]!.rate < best[0]!.rate ? worst[0]!.b : null,
  };
}
