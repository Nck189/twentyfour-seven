/**
 * Streak (SPEC §8.7): pure rules, mirrored by the server's `settle_days` (which grants the
 * tickets). A finished wake-day is one of:
 * - paused: a Vacation/Sick day — the streak waits, nothing is used up
 * - perfect / minimum: "I'm up" in the window + the Night ritual (a planned late night stands
 *   in for the ritual that night) → +1; perfect also needs Day OEE ≥ 80%
 * - frozen: not a minimum day, but a scarecrow saved the streak (one is used up)
 * - missed: not a minimum day and no scarecrow → the streak starts over
 */
import { PERFECT_DAY_OEE, STREAK_RULES as R } from "@/content/game";
import { dayOee, type DayFacts } from "./outcome";

export type DayKind = "perfect" | "minimum" | "frozen" | "paused" | "missed";
export type StreakState = { streak: number; best: number; freezes: number };
export type StreakGrant = {
  reason: "perfect_day" | "streak_7" | "streak_14" | "streak_30";
  date: string;
  amount: number;
};
export type SettledDay = { date: string; kind: DayKind; oee: number | null };

export const NO_STREAK: StreakState = { streak: 0, best: 0, freezes: 0 };

/** A planned late night (out late the night before the next day) excuses that night's ritual. */
const plannedLateNight = (d: DayFacts) => d.excused?.includes("free") ?? false;

/** Minimum day for the streak (SPEC §8.7; planned deviations don't break it, SPEC §8.4). */
export function streakMinimum(d: DayFacts): boolean {
  return d.wakeInWindow && (d.nightRitualDone || plannedLateNight(d));
}

export function dayKind(d: DayFacts, freezes: number): DayKind {
  if (d.mode !== "normal") return "paused";
  if (streakMinimum(d)) {
    const o = dayOee(d);
    return o !== null && o.oee >= PERFECT_DAY_OEE ? "perfect" : "minimum";
  }
  return freezes > 0 ? "frozen" : "missed";
}

/** Settles finished days in order, from a starting state. Returns each day, the new state and the tickets. */
export function settleStreak(
  days: readonly DayFacts[],
  start: StreakState = NO_STREAK,
): { days: SettledDay[]; state: StreakState; grants: StreakGrant[] } {
  let { streak, best, freezes } = start;
  const out: SettledDay[] = [];
  const grants: StreakGrant[] = [];
  for (const d of days) {
    const kind = dayKind(d, freezes);
    if (kind === "perfect" || kind === "minimum") {
      streak += 1;
      best = Math.max(best, streak);
      if (streak % R.freezeEvery === 0) freezes = Math.min(R.maxFreezes, freezes + 1);
      const milestone = R.milestones[streak];
      if (milestone)
        grants.push({ reason: `streak_${streak}` as StreakGrant["reason"], date: d.date, amount: milestone });
      if (kind === "perfect")
        grants.push({ reason: "perfect_day", date: d.date, amount: R.perfectDayTickets });
    } else if (kind === "frozen") {
      freezes -= 1;
    } else if (kind === "missed") {
      streak = 0;
    }
    out.push({ date: d.date, kind, oee: d.mode === "normal" ? (dayOee(d)?.oee ?? null) : null });
  }
  return { days: out, state: { streak, best, freezes }, grants };
}
