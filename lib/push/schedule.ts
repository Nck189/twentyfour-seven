/**
 * Push notifications (SPEC §9, M11): which reminders a day has, as pure data. Today plans them
 * from the day's blocks and uploads them (`set_push_schedule`); the server sends the due ones and
 * skips any that no longer apply (`push_due`: block already started, "I'm up" already pressed,
 * Night ritual already done). Every push shows a notification (iOS: no silent push).
 */
import type { BlockKey } from "@/content/blocks";
import { localParts } from "@/lib/time";

export const PUSH_KINDS = ["block_start", "first10", "wake", "night"] as const;
export type PushKind = (typeof PUSH_KINDS)[number];

export type PushPrefs = Record<PushKind, boolean> & {
  /** Local "HH:MM"; both set = no pushes from start until end (may wrap midnight). */
  quietStart: string | null;
  quietEnd: string | null;
};
export const DEFAULT_PUSH_PREFS: PushPrefs = {
  block_start: true,
  first10: true,
  wake: true,
  night: true,
  quietStart: null,
  quietEnd: null,
};

export type PushBlock = { key: BlockKey; start: Date; end: Date; first10: string | null };
export type PlannedPush = {
  kind: PushKind;
  /** Unique per user: `<kind>:<wake-day>[:<block>]`. */
  ref: string;
  fireAt: Date;
  block: BlockKey | null;
  /** The wake-day the push is about (the server checks it before sending). */
  day: string;
};

/** The first-10 nudge comes this long after a block's start, only if it hasn't started. */
export const FIRST10_NUDGE_MIN = 10;
/** The "I'm up" reminder comes this long after the wake target, only if not pressed yet. */
export const WAKE_REMIND_MIN = 10;
/** Plans further ahead than this are dropped (re-planned when Today opens again). */
export const PLAN_AHEAD_MS = 36 * 60 * 60_000;

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export function inQuietHours(
  at: Date,
  prefs: Pick<PushPrefs, "quietStart" | "quietEnd">,
  tz: string,
): boolean {
  if (!prefs.quietStart || !prefs.quietEnd) return false;
  const p = localParts(at, tz);
  const t = p.hour * 60 + p.minute;
  const a = toMin(prefs.quietStart);
  const b = toMin(prefs.quietEnd);
  if (a === b) return false;
  return a < b ? t >= a && t < b : t >= a || t < b;
}

/**
 * The day's reminders: each block's start (not Wake: it has its own reminder; not Sleep: the
 * Night ritual reminder covers bedtime), a first-10 nudge for blocks with a first-10, the Night
 * ritual at Down Time, and tomorrow's "I'm up" reminder (from the Sleep block's end = the next
 * wake target). Only future ones within PLAN_AHEAD_MS, minus quiet hours and turned-off kinds.
 */
export function planPushes(input: {
  /** The wake-day these blocks belong to. */
  day: string;
  /** The next wake-day (for tomorrow's "I'm up" reminder). */
  nextDay: string;
  blocks: readonly PushBlock[];
  prefs: PushPrefs;
  tz: string;
  now: Date;
  /** Vacation/Sick: no block nudges (G7 R-M11-8). */
  mode?: "normal" | "vacation" | "sick";
}): PlannedPush[] {
  const { day, nextDay, blocks, prefs, tz, now } = input;
  const nudges = (input.mode ?? "normal") === "normal";
  const out: PlannedPush[] = [];
  for (const b of blocks) {
    if (b.key === "down") {
      if (prefs.night) out.push({ kind: "night", ref: `night:${day}`, fireAt: b.start, block: "down", day });
      continue;
    }
    if (b.key === "sleep") {
      if (prefs.wake)
        out.push({
          kind: "wake",
          ref: `wake:${nextDay}`,
          fireAt: new Date(b.end.getTime() + WAKE_REMIND_MIN * 60_000),
          block: null,
          day: nextDay,
        });
      continue;
    }
    if (b.key === "wake") {
      // Today flips to the new day at the wake target, so this day's own "I'm up" reminder must be
      // planned from its Wake block too, or a re-plan in the first minutes deletes it (G7 R-M11-2).
      if (prefs.wake)
        out.push({
          kind: "wake",
          ref: `wake:${day}`,
          fireAt: new Date(b.start.getTime() + WAKE_REMIND_MIN * 60_000),
          block: null,
          day,
        });
      continue;
    }
    if (!nudges) continue;
    if (prefs.block_start)
      out.push({
        kind: "block_start",
        ref: `block_start:${day}:${b.key}`,
        fireAt: b.start,
        block: b.key,
        day,
      });
    const nudge = new Date(b.start.getTime() + FIRST10_NUDGE_MIN * 60_000);
    if (prefs.first10 && b.first10 && nudge < b.end)
      out.push({ kind: "first10", ref: `first10:${day}:${b.key}`, fireAt: nudge, block: b.key, day });
  }
  return out
    .filter((p) => p.fireAt > now && p.fireAt.getTime() - now.getTime() <= PLAN_AHEAD_MS)
    .filter((p) => !inQuietHours(p.fireAt, prefs, tz))
    .sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}
