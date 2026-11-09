/**
 * First-time tips (Minnie, 2026-11-09; BUILD_PLAN M10): one small bubble next to a feature the
 * first time it shows up. Listed in priority order: when several could show, the first wins.
 */
export const TIP_IDS = [
  "wake",
  "first10",
  "night",
  "exercise",
  "streak",
  "plan",
  "plots",
  "capsule",
] as const;
export type TipId = (typeof TIP_IDS)[number];

export const isTipId = (x: unknown): x is TipId => (TIP_IDS as readonly unknown[]).includes(x);
