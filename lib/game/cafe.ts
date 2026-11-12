/**
 * Som's café rules (docs/STORY.md, Minnie 2026-11-12): pure. Ordering is a game; the real-life
 * question comes right after an order at most once a day (yes / later / just playing), with one
 * bedtime fallback only after "later". Unanswered or "just playing" days never count as "no coffee".
 */
import { CARD_SIZE, isCaffeinated, type CoffeeAnswer, type CoffeeSlot, type DrinkId } from "@/content/cafe";

export function cardProgress(stamps: number): { cards: number; onCard: number } {
  const n = Math.max(0, Math.floor(stamps));
  return { cards: Math.floor(n / CARD_SIZE), onCard: n % CARD_SIZE };
}

/** Right after an order: only a caffeinated drink, once a wake-day, never when game-only. */
export function askAfterOrder(s: {
  answeredToday: CoffeeAnswer | null;
  gameOnly: boolean;
  drink: DrinkId;
}): boolean {
  return !s.gameOnly && s.answeredToday === null && isCaffeinated(s.drink);
}

/**
 * At bedtime, once: after "later", or after a caffeinated order whose question was left unanswered
 * (closed, switched tabs: G7 R-C6). Never after "yes" / "just playing", never when game-only.
 */
export function askAtBedtime(s: {
  answeredToday: CoffeeAnswer | null;
  nightAnswered: boolean;
  gameOnly: boolean;
  /** A caffeinated drink was ordered this wake-day. */
  orderedToday: boolean;
}): boolean {
  if (s.gameOnly || s.nightAnswered) return false;
  return s.answeredToday === "later" || (s.answeredToday === null && s.orderedToday);
}

const RANK: Record<CoffeeSlot, number> = { none: 0, morning: 1, afternoon: 2, evening: 3 };
/** Another real cup on a "yes" day: the day keeps its latest time of day (G7 R-C5). */
export function laterSlot(a: CoffeeSlot | null, b: CoffeeSlot): CoffeeSlot {
  return a !== null && RANK[a] >= RANK[b] ? a : b;
}

/** The time of day a real coffee counts in (the order's time for "yes"). */
export function slotOf(at: Date): Exclude<CoffeeSlot, "none"> {
  const h = at.getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

/** What a day says for the sleep insight, or null if it must be left out (never guessed). */
export function coffeeDay(row: { answer: CoffeeAnswer; slot: CoffeeSlot | null }): CoffeeSlot | null {
  if (row.answer === "play") return null;
  return row.slot ?? null;
}

/** Answered days needed on each side before the sleep insight shows (docs/STORY.md). */
export const COFFEE_MIN_DAYS = 8;

export type CoffeeSleep =
  | { ready: false; late: number; other: number }
  | {
      ready: true;
      late: number;
      other: number;
      /** Mean Goodnight on afternoon/evening-coffee days minus the rest, rounded to 5 min (+ = later). */
      diff: number;
    };

/**
 * The coffee → bedtime insight: days with a real afternoon/evening coffee vs days with none or only
 * a morning one. Only answered days with a Goodnight count (unanswered / "just playing" are left
 * out, never read as "no coffee"). `beds` = Goodnight per wake-day, minutes after local noon.
 * Null when there's nothing answered at all (the card stays hidden). Never claims cause.
 */
export function coffeeSleep(
  rows: readonly { day: string; answer: CoffeeAnswer; slot: CoffeeSlot | null }[],
  beds: ReadonlyMap<string, number>,
): CoffeeSleep | null {
  const late: number[] = [];
  const other: number[] = [];
  let answered = 0;
  for (const r of rows) {
    const s = coffeeDay(r);
    if (s === null) continue;
    answered++;
    const bed = beds.get(r.day);
    if (bed === undefined) continue;
    (s === "afternoon" || s === "evening" ? late : other).push(bed);
  }
  if (answered === 0) return null;
  if (late.length < COFFEE_MIN_DAYS || other.length < COFFEE_MIN_DAYS)
    return { ready: false, late: late.length, other: other.length };
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return {
    ready: true,
    late: late.length,
    other: other.length,
    diff: Math.round((mean(late) - mean(other)) / 5) * 5,
  };
}
