/**
 * Animal + exercise rules (SPEC §6, §8.6). Pure functions; the server mirrors them in SQL
 * (`log_exercise`, `_hatch_roll`, `collect_produce`, `pet_animal`) with parity tests.
 */
import { ANIMAL_IDS, ANIMALS, EXERCISE_RULES as R, HATCH_RATES, type AnimalId } from "@/content/animals";
import { RARITIES, type Rarity } from "@/content/crops";
import { localDate } from "@/lib/time";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export type WorkoutLog = { at: string; minutes: number };

/** Which logs count for feed/eggs: ≥ minMinutes, at most maxCountedPerDay per local day (in time order). */
export function countedWorkouts<T extends WorkoutLog>(logs: T[], timezone: string): T[] {
  const perDay = new Map<string, number>();
  const out: T[] = [];
  for (const l of [...logs].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
    if (l.minutes < R.minMinutes) continue;
    const d = localDate(new Date(l.at), timezone);
    const n = perDay.get(d) ?? 0;
    if (n >= R.maxCountedPerDay) continue;
    perDay.set(d, n + 1);
    out.push(l);
  }
  return out;
}

/** Workouts toward the next egg (0 … workoutsPerEgg − 1) and eggs hatched so far. */
export function eggProgress(counted: number): { progress: number; hatched: number } {
  return { progress: counted % R.workoutsPerEgg, hatched: Math.floor(counted / R.workoutsPerEgg) };
}

/** Feed added on top of what's left (never from the past), capped at maxFeedDays ahead. */
export function addFeed(fedUntil: Date | null, now: Date, days: number): Date {
  const base = Math.max(now.getTime(), fedUntil?.getTime() ?? 0);
  return new Date(Math.min(base + days * DAY, now.getTime() + R.maxFeedDays * DAY));
}

/** Hungry animals are sleepy and sad — never dead (SPEC §8.6). */
export const isFed = (fedUntil: Date | null, now: Date) =>
  fedUntil !== null && fedUntil.getTime() > now.getTime();

/** A fed animal has produce ready once a full interval has passed since its last (or its birth). */
export function produceReady(
  a: { fedUntil: Date | null; lastProduced: Date | null; createdAt: Date },
  now: Date,
) {
  const since = (a.lastProduced ?? a.createdAt).getTime();
  return isFed(a.fedUntil, now) && now.getTime() - since >= R.produceEveryHours * HOUR;
}

/** Love as 0–5 hearts. */
export const loveHearts = (love: number) => Math.min(5, Math.floor(Math.max(0, love) / (R.maxLove / 5)));

/** Days of feed left (rounded up), 0 when hungry. */
export const feedDaysLeft = (fedUntil: Date | null, now: Date) =>
  isFed(fedUntil, now) ? Math.ceil((fedUntil!.getTime() - now.getTime()) / DAY) : 0;

/** The hatch roll: rarity from r ∈ [0,1), species evenly within it from c ∈ [0,1). */
export function hatchRoll(r: number, c: number): { rarity: Rarity; species: AnimalId } {
  let acc = 0;
  let rarity: Rarity = "common";
  for (const k of [...RARITIES].reverse()) {
    acc += HATCH_RATES[k];
    if (r < acc) {
      rarity = k;
      break;
    }
  }
  const pool = ANIMAL_IDS.filter((id) => ANIMALS[id].rarity === rarity);
  return { rarity, species: pool[Math.min(pool.length - 1, Math.floor(c * pool.length))]! };
}
