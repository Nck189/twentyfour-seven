/**
 * The farm yard's spots (docs/FARM_YARD_PLAN.md): where decor stands on the farm scene, as a share
 * of the scene's width (x) and of the yard band's height (y, 0 = back, 1 = front). Spot 1 is
 * first filled. Kept in the field's margins so decor never covers a plot.
 */
export const YARD_SPOTS = [
  { spot: 1, x: 0.08, y: 0.25 },
  { spot: 2, x: 0.92, y: 0.25 },
  { spot: 3, x: 0.22, y: 0.8 },
  { spot: 4, x: 0.78, y: 0.8 },
  { spot: 5, x: 0.36, y: 0.35 },
  { spot: 6, x: 0.64, y: 0.35 },
  { spot: 7, x: 0.06, y: 0.85 },
  { spot: 8, x: 0.94, y: 0.85 },
] as const;
export type YardSpot = (typeof YARD_SPOTS)[number]["spot"];
export const YARD_SIZE = YARD_SPOTS.length;
/** Placed decor that brings visitors (cosmetic only). */
export const BUTTERFLIES_FROM = 3;
export const BIRDS_FROM = 6;
