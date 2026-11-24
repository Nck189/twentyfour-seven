import { BIRDS_FROM, BUTTERFLIES_FROM, YARD_SPOTS } from "@/content/yard";

/** A small stable hash (FNV-1a): the same day always picks the same spot. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The placed spot Som sits next to today (stable all day), or null with nothing placed. */
export function somSpotOfDay(placed: readonly number[], date: string): number | null {
  if (placed.length === 0) return null;
  const sorted = [...placed].sort((a, b) => a - b);
  return sorted[hash(`som-yard:${date}`) % sorted.length]!;
}

/** Visitors that come with a prettier yard (cosmetic only). */
export function visitors(placedCount: number): { butterflies: number; birds: number } {
  return {
    butterflies: placedCount >= BIRDS_FROM ? 3 : placedCount >= BUTTERFLIES_FROM ? 2 : 0,
    birds: placedCount >= BIRDS_FROM ? 2 : 0,
  };
}

/** The gap Som sits in beside an item: to its right in the left half of the yard, else to its left. */
export function somGap(spot: number | null): { x: number; front: boolean } | null {
  const s = YARD_SPOTS.find((p) => p.spot === spot);
  if (!s) return null;
  return { x: s.x < 0.5 ? s.x + 0.125 : s.x - 0.125, front: s.y > 0.5 };
}

/**
 * Where visitors stand, as a share of the yard's width, never on Som (G7 TS S3-3): butterflies
 * hover over item columns, which Som never sits in; birds walk the front row's gaps, minus Som's
 * when he's in the front row.
 */
export function visitorPlaces(
  somSpot: number | null,
  count: { butterflies: number; birds: number },
): { butterflies: number[]; birds: number[] } {
  const som = somGap(somSpot);
  const gaps = [0.25, 0.5, 0.75].filter((g) => !(som?.front && Math.abs(som.x - g) < 0.01));
  return {
    butterflies: [0.125, 0.625, 0.875].slice(0, count.butterflies),
    birds: gaps.slice(0, count.birds),
  };
}
