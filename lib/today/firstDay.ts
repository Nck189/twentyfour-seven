/**
 * A new account's first day (review fix C1, docs/GROWTH.md G1 "easy first week"): pure rules.
 */
import { currentDayDate, type DayContext } from "./day";

/** The account was made during wake-day `dayDate` (a day runs wake → next wake, in its timezone). */
export function isFirstDay(ctx: DayContext, createdAt: Date, dayDate: string): boolean {
  return currentDayDate(ctx, createdAt) === dayDate;
}

/**
 * Today's "I'm up" was over before the account existed: its window (the target plus `windowMin`)
 * had already closed. Offering it would ask someone signing up at 23:00 to "get out of bed".
 */
export function missedFirstWake(createdAt: Date, wakeTarget: Date, windowMin = 15): boolean {
  return createdAt.getTime() > wakeTarget.getTime() + windowMin * 60_000;
}
