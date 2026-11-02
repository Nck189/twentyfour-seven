import { parseHHMM } from "./plan";

export type KaizenSettings = { enabled: boolean; step_min: number; floor: string; threshold: number };

const fmt = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/**
 * Optional Kaizen target (SPEC §2.2): if wake success this week ≥ threshold (default 5/7),
 * next week's target wake moves step_min earlier, never earlier than the floor.
 * Never moves later, and never touches targets already at/below the floor.
 */
export function nextKaizenTarget(currentTarget: string, wakeSuccesses: number, k: KaizenSettings): string {
  const cur = parseHHMM(currentTarget);
  if (!k.enabled || wakeSuccesses < k.threshold) return fmt(cur);
  const floor = parseHHMM(k.floor);
  if (cur <= floor) return fmt(cur);
  return fmt(Math.max(floor, cur - k.step_min));
}
