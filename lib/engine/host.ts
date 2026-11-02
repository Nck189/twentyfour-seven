import type { BlockKey } from "@/content/blocks";
import type { DayPlan } from "./types";

/**
 * Which block holds a one-off appointment at `at`: the waking block its time falls in.
 * Before wake-up → Wake (the morning moves earlier); after the last waking block → Free.
 */
export function hostFor(plan: Pick<DayPlan, "blocks">, at: Date): BlockKey {
  const day = plan.blocks.filter((b) => b.key !== "down" && b.key !== "sleep");
  if (!day.length) return "work";
  const t = at.getTime();
  const hit = day.find((b) => b.start.getTime() <= t && t < b.end.getTime());
  if (hit) return hit.key;
  return t < day[0].start.getTime() ? day[0].key : day[day.length - 1].key;
}
