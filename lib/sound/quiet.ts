/**
 * Auto-quiet (docs/STORY.md, Minnie OK 2026-11-12): sounds turn themselves off during the Focus
 * and Work blocks (class, office) and come back after. Pure; the mute always wins, and a timer
 * the user set (essential, e.g. the power-nap alarm) still rings during a quiet block.
 */
import type { BlockKey } from "@/content/blocks";

const QUIET_BLOCKS: readonly BlockKey[] = ["focus", "work"];

export function quietUntilFor(block: { key: BlockKey; end: Date } | null | undefined): number {
  return block && QUIET_BLOCKS.includes(block.key) ? block.end.getTime() : 0;
}

export function shouldPlay(s: {
  soundOn: boolean;
  autoQuiet: boolean;
  quietUntil: number;
  now: number;
  essential?: boolean;
}): boolean {
  if (!s.soundOn) return false;
  if (s.essential) return true;
  return !(s.autoQuiet && s.now < s.quietUntil);
}
