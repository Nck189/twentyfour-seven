/**
 * Retention for Minnie (G3, docs/GROWTH.md): sign-up cohorts by week, and the share of each cohort
 * active on day 1 / 7 / 14 / 30 after signing up ("active" = anything logged that local day). Pure;
 * the admin page feeds it server-side data. A day that hasn't come yet for a cohort is null.
 */
import { addDays } from "@/lib/time";

export const RETENTION_DAYS = [1, 7, 14, 30] as const;
export type RetentionDay = (typeof RETENTION_DAYS)[number];

export type Cohort = {
  /** Monday of the sign-up week (YYYY-MM-DD). */
  week: string;
  n: number;
  /** Share active on day k (0..1); null while day k is still in the future for the whole cohort. */
  rate: Record<RetentionDay, number | null>;
};

/** ISO-week Monday for a YYYY-MM-DD date. */
export function weekOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Mon = 0
  return addDays(date, -dow);
}

export function retention(
  users: readonly { id: string; signup: string }[],
  active: ReadonlyMap<string, ReadonlySet<string>>,
  today: string,
): Cohort[] {
  const byWeek = new Map<string, { id: string; signup: string }[]>();
  for (const u of users) byWeek.set(weekOf(u.signup), [...(byWeek.get(weekOf(u.signup)) ?? []), u]);
  return [...byWeek.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([week, us]) => {
      const rate = {} as Record<RetentionDay, number | null>;
      for (const k of RETENTION_DAYS) {
        // Only users whose day k has already happened count (day k ≤ today).
        const due = us.filter((u) => addDays(u.signup, k) <= today);
        rate[k] = due.length
          ? due.filter((u) => active.get(u.id)?.has(addDays(u.signup, k))).length / due.length
          : null;
      }
      return { week, n: us.length, rate };
    });
}
