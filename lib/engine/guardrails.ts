import { localParts } from "@/lib/time";

/**
 * Bedtimes cluster around midnight, so map them onto a "night clock": minutes after local noon
 * (12:00 → 0, 00:00 → 720, 03:00 → 900). Means and SDs then don't break across midnight.
 */
export function nightMinutes(instant: Date, tz: string): number {
  const p = localParts(instant, tz);
  const m = p.hour * 60 + p.minute;
  return m >= 720 ? m - 720 : m + 720;
}

/** Morning clock for wake times: minutes after local midnight. */
export function dayMinutes(instant: Date, tz: string): number {
  const p = localParts(instant, tz);
  return p.hour * 60 + p.minute;
}

export function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

/** Population standard deviation. */
export function sd(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

/** Planned bedtime minus the mean of recent bedtimes (minutes, + = later). Null without history. */
export function bedtimeDrift(planned: Date, recent: Date[], tz: string): number | null {
  if (recent.length === 0) return null;
  return Math.round(nightMinutes(planned, tz) - mean(recent.map((d) => nightMinutes(d, tz))));
}

export type RegularityResult = { bedSdMin: number; wakeSdMin: number; score: number };

/**
 * Sleep regularity over a rolling window (SPEC §3/§7): SD of bed and wake times.
 * Score 0–100: 100 = identical times every day, 0 = average SD of 2 hours or more.
 */
export function sleepRegularity(bedtimes: Date[], wakes: Date[], tz: string): RegularityResult {
  const bedSdMin = sd(bedtimes.map((d) => nightMinutes(d, tz)));
  const wakeSdMin = sd(wakes.map((d) => dayMinutes(d, tz)));
  const avg = (bedSdMin + wakeSdMin) / 2;
  const score = Math.round(100 * Math.max(0, 1 - avg / 120));
  return { bedSdMin: Math.round(bedSdMin), wakeSdMin: Math.round(wakeSdMin), score };
}
