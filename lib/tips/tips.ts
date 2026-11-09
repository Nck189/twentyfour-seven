import { TIP_IDS, type TipId } from "@/content/tips";

/**
 * Which tip shows (pure): the first in priority order that is on screen, not seen yet, with tips
 * not turned off and none dismissed during this screen visit (one at a time, never a chain).
 */
export function activeTip(
  mounted: ReadonlySet<TipId>,
  seen: ReadonlySet<TipId>,
  off: boolean,
  dismissedThisVisit: boolean,
): TipId | null {
  if (off || dismissedThisVisit) return null;
  return TIP_IDS.find((id) => mounted.has(id) && !seen.has(id)) ?? null;
}
