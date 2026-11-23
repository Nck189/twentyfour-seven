import { BIRDS_FROM, BUTTERFLIES_FROM } from "@/content/yard";

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
