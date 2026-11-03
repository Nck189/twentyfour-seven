import { MUTATION_IDS, MUTATION_MULTIPLIER, type MutationId } from "@/content/game";
import { first10Done, isPerfectDay, startedOnTime, type DayFacts } from "./outcome";

/**
 * The mutations a day's behavior earns (SPEC §8.3). They are the NEXT day's "weather": crops
 * that grow on that next day pick them up. Backfilled logs earn nothing.
 */
export function earnedMutations(day: DayFacts): MutationId[] {
  if (day.mode !== "normal") return [];
  const out = new Set<MutationId>();
  if (day.wakeInWindow) out.add("sunrise_glow");
  if (first10Done(day.logs.wake)) out.add("dew");
  const down = day.logs.down;
  if (down && first10Done(down) && startedOnTime(down)) out.add("moonlit");
  const out_ = (b: "focus" | "work") => {
    const l = day.logs[b];
    return !!l && !l.backfilled && l.location === "out" && !!l.started_at;
  };
  if (out_("focus") || out_("work")) out.add("breeze");
  if (day.exercised) out.add("spark");
  if (isPerfectDay(day)) out.add("rainbow");
  return MUTATION_IDS.filter((m) => out.has(m));
}

/** Mutations stack multiplicatively (each counts once per crop). */
export function mutationMultiplier(ms: readonly MutationId[]): number {
  return [...new Set(ms)].reduce((m, id) => m * MUTATION_MULTIPLIER[id], 1);
}
