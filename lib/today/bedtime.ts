import { ON_TIME_MIN } from "@/content/game";

type SleepLog = { started_at: string | null; first10_at: string | null; miss_reason: string | null };

/** How long before Sleep's planned start Today offers the "Going to bed" card. */
export const BED_CARD_MIN = 30;

/**
 * What Goodnight does to tonight's Sleep (Minnie 2026-11-10; G7 R-M10-R3-1): it starts Sleep only
 * when that start could count, i.e. from 10 min before the planned bedtime on. Earlier (the ritual
 * usually runs at the start of Down Time) it leaves Sleep alone, and Today offers "Going to bed"
 * near bedtime instead. Never moves a start, never overrides a miss reason; ticks the first-10
 * (alarm + phone away) unless Sleep has none or it's already ticked. Null = do nothing.
 */
export function goodnightSleep(
  log: SleepLog,
  plannedStart: Date,
  now: Date,
  hasFirst10: boolean,
): { first10: boolean } | null {
  if (log.miss_reason) return null;
  if (now.getTime() < plannedStart.getTime() - ON_TIME_MIN * 60_000) return null;
  const first10 = hasFirst10 && !log.first10_at;
  if (log.started_at && !first10) return null;
  return { first10 };
}

/**
 * Today shows "Going to bed" after the ritual, from 30 min before bedtime, until Sleep is started
 * and its first-10 ticked (or it has none).
 */
export function showBedCard(
  log: SleepLog,
  plannedStart: Date,
  now: Date,
  nightDone: boolean,
  current: string | undefined,
  hasFirst10: boolean,
): boolean {
  if (!nightDone || log.miss_reason) return false;
  if (log.started_at && (log.first10_at || !hasFirst10)) return false;
  if (current === "sleep") return true;
  return current === "down" && now.getTime() >= plannedStart.getTime() - BED_CARD_MIN * 60_000;
}
