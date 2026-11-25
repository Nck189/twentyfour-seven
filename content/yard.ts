/**
 * The farm yard's spots (docs/FARM_YARD_PLAN.md): two tidy rows of 4 in the yard band below the
 * plots, as a share of the band's width (x) and height (y, 0 = back, 1 = front). Numbered in
 * reading order (back row, then front, each left to right), which is also the order new decor
 * fills them, and the "Move to…" picker's 4 × 2 grid is the same map (Minnie 2026-11-24: the old
 * zigzag looked random).
 */
const COLS = [0.125, 0.375, 0.625, 0.875] as const;
export const YARD_SPOTS = [
  { spot: 1, x: COLS[0], y: 0 },
  { spot: 2, x: COLS[1], y: 0 },
  { spot: 3, x: COLS[2], y: 0 },
  { spot: 4, x: COLS[3], y: 0 },
  { spot: 5, x: COLS[0], y: 1 },
  { spot: 6, x: COLS[1], y: 1 },
  { spot: 7, x: COLS[2], y: 1 },
  { spot: 8, x: COLS[3], y: 1 },
] as const;
export type YardSpot = (typeof YARD_SPOTS)[number]["spot"];
export const YARD_SIZE = YARD_SPOTS.length;
/** Placed decor that brings visitors (cosmetic only). */
export const BUTTERFLIES_FROM = 3;
export const BIRDS_FROM = 6;
