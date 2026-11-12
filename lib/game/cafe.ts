/**
 * Som's café rules (docs/STORY.md, Minnie 2026-11-12): pure. Ordering is a game; the real-life
 * question comes right after an order at most once a day (yes / later / just playing), with one
 * bedtime fallback only after "later". Unanswered or "just playing" days never count as "no coffee".
 */
import { CARD_SIZE, type CoffeeAnswer, type CoffeeSlot } from "@/content/cafe";

export function cardProgress(stamps: number): { cards: number; onCard: number } {
  const n = Math.max(0, Math.floor(stamps));
  return { cards: Math.floor(n / CARD_SIZE), onCard: n % CARD_SIZE };
}

export function askAfterOrder(s: { answeredToday: CoffeeAnswer | null; gameOnly: boolean }): boolean {
  return !s.gameOnly && s.answeredToday === null;
}

export function askAtBedtime(s: {
  answeredToday: CoffeeAnswer | null;
  nightAnswered: boolean;
  gameOnly: boolean;
}): boolean {
  return !s.gameOnly && s.answeredToday === "later" && !s.nightAnswered;
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
