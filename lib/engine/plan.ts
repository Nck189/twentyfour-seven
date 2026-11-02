import { BLOCK_KEYS, type BlockKey } from "@/content/blocks";
import { addDays, localDate, zonedInstant } from "@/lib/time";
import { bedtimeDrift } from "./guardrails";
import type { DayPlan, PlanInput, PlannedBlock, PlannedFixedEvent, PlannedSubSlot, Warning } from "./types";

/**
 * Scheduling engine (SPEC §3). Pure: no I/O, no clock, timezone from input.
 *
 * Model: day D's working window runs from the bedtime the night before D (B) to the next
 * bedtime (B'). After B the chain is Sleep → Wake → Focus → Work → Gradation → Free → Down(next).
 * - B is the anchor: pushing it later pushes D's wake and every block of D.
 * - B' snaps back to D+1's template target, so lost time comes out of flexible blocks and
 *   drift never accumulates.
 * - When something must give, compress in COMPRESSION_ORDER down to MIN_DURATION.
 * - Fixed events never move; blocks before their host block get compressed instead.
 * The plan also shows the Down block before B (the evening D's night ritual starts).
 */

export const MIN_DURATION: Record<BlockKey, number> = {
  down: 30,
  sleep: 0,
  wake: 30,
  focus: 0,
  work: 0,
  gradation: 0,
  free: 0,
};

/** SPEC §3: Free → Gradation → Focus → Down → Wake → Sleep (last). */
export const COMPRESSION_ORDER: BlockKey[] = ["free", "gradation", "focus", "down", "wake", "sleep"];

/** Blocks after bedtime B in day D's window; "down" here is the NEXT night's Down. */
export const CHAIN_AFTER_BEDTIME: BlockKey[] = [
  "sleep",
  "wake",
  "focus",
  "work",
  "gradation",
  "free",
  "down",
];

const MIN = 60_000;

export function parseHHMM(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(hhmm);
  if (!m) throw new Error(`invalid time "${hhmm}"`);
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 23 || mm > 59) throw new Error(`invalid time "${hhmm}"`);
  return h * 60 + mm;
}

const minutesBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / MIN);
const plus = (d: Date, minutes: number) => new Date(d.getTime() + minutes * MIN);

/** Target bedtime the night before `date` = target wake − sleep duration. */
export function targetBedtime(date: string, targetWake: string, sleepMin: number, tz: string): Date {
  return plus(zonedInstant(date, parseHHMM(targetWake), tz), -sleepMin);
}

type Durations = Record<BlockKey, number>;

/** Takes up to `amount` minutes from `blocks` in order, respecting minimums. Returns what's left. */
function compress(d: Durations, blocks: BlockKey[], amount: number): number {
  let left = amount;
  for (const k of blocks) {
    if (left <= 0) break;
    const take = Math.min(left, Math.max(0, d[k] - MIN_DURATION[k]));
    d[k] -= take;
    left -= take;
  }
  return left;
}

/** Gives `amount` minutes back to `blocks` in order, up to their desired length; remainder → last. */
function restore(d: Durations, desired: Durations, blocks: BlockKey[], amount: number) {
  let left = amount;
  for (const k of blocks) {
    if (left <= 0) break;
    const give = Math.min(left, Math.max(0, desired[k] - d[k]));
    d[k] += give;
    left -= give;
  }
  if (left > 0) d[blocks[blocks.length - 1]] += left;
}

const prefixBefore = (d: Durations, host: BlockKey) => {
  let sum = 0;
  for (const k of CHAIN_AFTER_BEDTIME) {
    if (k === host) return sum;
    sum += d[k];
  }
  return sum;
};

export function planDay(input: PlanInput): DayPlan {
  const tz = input.timezone;
  const desired: Durations = { ...input.durations };
  const warnings: Warning[] = [];

  for (const k of BLOCK_KEYS) {
    if (!Number.isFinite(desired[k]) || desired[k] < 0) throw new Error(`invalid duration for ${k}`);
  }

  // --- Anchors ---------------------------------------------------------------------------
  const bedtimeTarget = targetBedtime(input.date, input.targetWake, desired.sleep, tz);
  let bedtime = input.bedtimeOverride ?? bedtimeTarget;
  let downBeforeMin = desired.down;
  const planned = Boolean(input.lateNightReturn);
  if (input.lateNightReturn) {
    // Down starts when you get home (shrinks to its minimum). Coming home early never pulls bedtime earlier.
    const afterReturn = plus(input.lateNightReturn, MIN_DURATION.down);
    if (afterReturn.getTime() > bedtime.getTime()) {
      bedtime = afterReturn;
      downBeforeMin = MIN_DURATION.down;
    }
  }
  const nextDate = addDays(input.date, 1);
  const nextBedtime =
    input.nextBedtimeOverride ??
    targetBedtime(nextDate, input.nextTargetWake, input.nextSleepMin ?? desired.sleep, tz);

  // --- Fit the chain into [bedtime, nextBedtime] -----------------------------------------
  // The chain ends with the NEXT night's Down, which may be shorter (late night tomorrow).
  const chainDesired: Durations = { ...desired, down: input.nextDownMin ?? desired.down };
  const d: Durations = { ...chainDesired };
  const window = minutesBetween(bedtime, nextBedtime);
  const wanted = CHAIN_AFTER_BEDTIME.reduce((s, k) => s + d[k], 0);
  if (wanted > window) {
    const short = compress(d, COMPRESSION_ORDER, wanted - window);
    if (short > 0) warnings.push({ type: "day_overfull", shortByMin: short });
  } else if (wanted < window) {
    d.free += window - wanted; // an earlier night gives the extra time to Free
  }

  // --- Fixed events win ------------------------------------------------------------------
  const events = (input.fixedEvents ?? [])
    .map((e) => {
      const startMin = parseHHMM(e.start);
      let endMin = parseHHMM(e.end);
      if (endMin <= startMin) endMin += 1440; // crosses midnight
      return {
        id: e.id,
        host: e.host ?? ("work" as BlockKey),
        start: zonedInstant(input.date, startMin, tz),
        end: zonedInstant(input.date, endMin, tz),
      };
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  for (const ev of events) {
    const hostIdx = CHAIN_AFTER_BEDTIME.indexOf(ev.host);
    const before = CHAIN_AFTER_BEDTIME.slice(0, hostIdx);
    const after = CHAIN_AFTER_BEDTIME.slice(hostIdx + 1);

    // 1) The host block must start no later than the event.
    const available = minutesBetween(bedtime, ev.start);
    const over = prefixBefore(d, ev.host) - available;
    if (over > 0) {
      const order = COMPRESSION_ORDER.filter((k) => before.includes(k));
      const late = compress(d, order, over);
      if (late > 0) warnings.push({ type: "fixed_event_conflict", eventId: ev.id, lateByMin: late });
      // Time freed before the host goes to the end of the day (Down, then Gradation, then Free).
      const freed = over - late;
      const restoreOrder = (["down", "gradation", "free"] as BlockKey[]).filter((k) => after.includes(k));
      if (restoreOrder.length) restore(d, chainDesired, restoreOrder, freed);
    }

    // 2) The host block must last until the event ends.
    const hostEnd = prefixBefore(d, ev.host) + d[ev.host];
    const needEnd = minutesBetween(bedtime, ev.end);
    if (hostEnd < needEnd) {
      const grow = needEnd - hostEnd;
      const order = COMPRESSION_ORDER.filter((k) => after.includes(k));
      const missing = compress(d, order, grow);
      d[ev.host] += grow - missing;
      if (missing > 0) warnings.push({ type: "fixed_event_conflict", eventId: ev.id, lateByMin: missing });
    }
  }

  // --- Build blocks ----------------------------------------------------------------------
  const blocks: PlannedBlock[] = [];
  const downBefore: PlannedBlock = {
    key: "down",
    start: plus(bedtime, -downBeforeMin),
    end: bedtime,
    durationMin: downBeforeMin,
    desiredMin: desired.down,
    compressedMin: desired.down - downBeforeMin,
    subSlots: [],
  };
  blocks.push(downBefore);

  let cursor = bedtime;
  for (const k of CHAIN_AFTER_BEDTIME) {
    if (k === "down") break; // next night's Down belongs to D+1's plan
    blocks.push({
      key: k,
      start: cursor,
      end: plus(cursor, d[k]),
      durationMin: d[k],
      desiredMin: desired[k],
      compressedMin: Math.max(0, desired[k] - d[k]),
      subSlots: [],
    });
    cursor = plus(cursor, d[k]);
  }

  // Sub-slots move with their block; clipped when the block got shorter.
  for (const b of blocks) {
    const slots = input.subSlots?.[b.key] ?? [];
    b.subSlots = slots.map((s): PlannedSubSlot => {
      const start = new Date(Math.min(plus(b.start, s.offsetMin).getTime(), b.end.getTime()));
      const rawEnd = plus(start, s.durationMin);
      const end = new Date(Math.min(rawEnd.getTime(), b.end.getTime()));
      return { ...s, start, end, clipped: end.getTime() < rawEnd.getTime() || s.offsetMin >= b.durationMin };
    });
  }

  // --- Warnings --------------------------------------------------------------------------
  if (d.sleep < desired.sleep)
    warnings.push({ type: "short_sleep", sleepMin: d.sleep, desiredMin: desired.sleep });

  if (input.gymClose) {
    const closeMin = parseHHMM(input.gymClose);
    for (const b of blocks) {
      for (const s of b.subSlots) {
        if (s.kind !== "gym") continue;
        const close = zonedInstant(localDate(s.start, tz), closeMin, tz);
        if (s.end.getTime() > close.getTime())
          warnings.push({ type: "gym_after_close", slotId: s.id, endsAt: s.end });
      }
    }
  }

  if (input.recentBedtimes?.length) {
    const drift = bedtimeDrift(bedtime, input.recentBedtimes, tz);
    if (drift !== null && Math.abs(drift) > 60) warnings.push({ type: "bedtime_drift", deltaMin: drift });
  }

  const fixedEvents: PlannedFixedEvent[] = events.map((e) => ({
    id: e.id,
    start: e.start,
    end: e.end,
    host: e.host,
  }));
  const wake = blocks.find((b) => b.key === "wake")!.start;

  return {
    date: input.date,
    bedtime,
    wake,
    nextBedtime,
    blocks,
    fixedEvents,
    warnings,
    planned,
    pushMin: minutesBetween(bedtimeTarget, bedtime),
  };
}
