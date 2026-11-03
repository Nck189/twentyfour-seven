import { BLOCK_KEYS, type BlockKey } from "@/content/blocks";
import { CROPS } from "@/content/crops";
import { GIANT_MERGE_CHANCE, type MutationId } from "@/content/game";
import { simulatePlot, type Planting, type PlotView } from "./growth";
import { earnedMutations } from "./mutations";
import { blockResult, type DayFacts } from "./outcome";

/** Deterministic 0..1 from a string (FNV-1a), so the same data always gives the same farm. */
export function roll(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h / 0x100000000;
}

export type Giant = { slots: [BlockKey, BlockKey, BlockKey]; cropId: PlotView["cropId"]; on: string };

/**
 * Giant crops (SPEC §8.2 \*): 3 adjacent block plots (consecutive blocks in chain order) with the
 * same giant-capable crop, all ready → on each later day all 3 blocks succeed, a seeded roll
 * (GIANT_MERGE_CHANCE) may merge them. A plot is in at most one giant (earliest slots first).
 */
export function findGiants(
  plots: Partial<Record<BlockKey, PlotView>>,
  days: readonly DayFacts[],
  seed: string,
): Giant[] {
  const out: Giant[] = [];
  const used = new Set<BlockKey>();
  for (let i = 0; i + 2 < BLOCK_KEYS.length; i++) {
    const slots = [BLOCK_KEYS[i]!, BLOCK_KEYS[i + 1]!, BLOCK_KEYS[i + 2]!] as Giant["slots"];
    if (slots.some((s) => used.has(s))) continue;
    const ps = slots.map((s) => plots[s]);
    const first = ps[0];
    if (!first || !CROPS[first.cropId].giant) continue;
    if (!ps.every((p) => p && p.cropId === first.cropId && p.status === "ready")) continue;
    // The trio can only merge on days after all three were ready.
    const since = ps.map((p) => p!.readyOn!).reduce((a, b) => (a > b ? a : b));
    const hit = days.find(
      (d) =>
        d.date > since &&
        slots.every((s) => blockResult(d, s) === "success") &&
        roll(`${seed}:${d.date}:${slots.join(",")}`) < GIANT_MERGE_CHANCE,
    );
    if (hit) {
      out.push({ slots, cropId: first.cropId, on: hit.date });
      slots.forEach((s) => used.add(s));
    }
  }
  return out;
}

export type FarmState = {
  plots: Partial<Record<BlockKey, PlotView>>;
  giants: Giant[];
  /** Today's weather: the mutations yesterday earned (shown as tints in the sky/field). */
  weather: MutationId[];
};

/**
 * The whole farm from data (SPEC §8): block plots from their plantings, giants, today's weather.
 * Pure: the same plantings + days always give the same farm.
 */
export function farmState(
  plantings: readonly Planting[],
  days: readonly DayFacts[],
  seed: string,
): FarmState {
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const plots: FarmState["plots"] = {};
  for (const p of plantings) plots[p.slot] = simulatePlot(p, sorted);
  const last = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  const weather =
    last && prev && Date.parse(`${last.date}T00:00:00Z`) - Date.parse(`${prev.date}T00:00:00Z`) === 86_400_000
      ? earnedMutations(prev)
      : [];
  return { plots, giants: findGiants(plots, sorted, seed), weather };
}
