import type { BlockKey } from "@/content/blocks";
import type { IconSkyVariant } from "@/components/art/IconSky";

/**
 * Som in Today's header follows the current block (review fix F4; Minnie: "can the icon change
 * with the current block?"): sunrise for Wake, day for the day's blocks, dusk for Down Time,
 * night with closed eyes for Sleep. The Home Screen icon can't change (iOS/Android fix it).
 */
export function markFor(block: BlockKey | null | undefined): IconSkyVariant {
  switch (block) {
    case "wake":
      return "sunrise";
    case "down":
      return "dusk";
    case "sleep":
      return "night";
    default:
      return "meadow";
  }
}
