import type { DayContext } from "./day";

/** How long the app must stay in the background before coming back triggers a refresh. */
export const FOREGROUND_REFRESH_MS = 60_000;

/**
 * CJ-15: refetching on every visibilitychange re-rendered Today mid-tap and could drop the tap.
 * Only a real absence (≥ 60 s, e.g. an iOS home-screen app left open overnight) refreshes;
 * realtime keeps short absences in sync.
 */
export function shouldRefreshOnForeground(hiddenAt: number | null, now: number): boolean {
  if (hiddenAt === null) return false;
  return now - hiddenAt >= FOREGROUND_REFRESH_MS;
}

/** True when a refetched context holds the same data, so the old object can be kept. */
export function sameDayContext(a: DayContext, b: DayContext): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
