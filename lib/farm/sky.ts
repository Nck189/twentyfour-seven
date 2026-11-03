import type { BlockKey } from "@/content/blocks";

export type SkyPhase = "day" | "sunrise" | "dusk" | "night";

/** SPEC §8.9: the sky follows the current block — Down = dusk, Sleep = stars, Wake = sunrise. */
export function skyPhaseFor(block: BlockKey | undefined): SkyPhase {
  if (block === "down") return "dusk";
  if (block === "sleep") return "night";
  if (block === "wake") return "sunrise";
  return "day";
}

/** How far back the farm reads logs (a crop older than this is long ripe or dead). */
export const FARM_HISTORY_DAYS = 90;
