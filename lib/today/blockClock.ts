"use client";

/**
 * The current block on any screen (G7 STORY-R6/R8). Today computes the day's blocks; it saves their
 * times here (per device), so auto-quiet and Som's director know the block even when the app opens
 * straight on the Farm or More. Pure helpers + a small persisted store. Outside the saved day,
 * nothing is known and nothing is guessed (sounds play, beats may play: the safe defaults).
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { BlockKey } from "@/content/blocks";

export type SavedBlock = { key: BlockKey; start: string; end: string };
export type ClockBlock = { key: BlockKey; start: Date; end: Date };

export function blockAt(blocks: readonly SavedBlock[], now: Date): ClockBlock | null {
  const t = now.getTime();
  for (const b of blocks) {
    const start = new Date(b.start);
    const end = new Date(b.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    if (t >= start.getTime() && t < end.getTime()) return { key: b.key, start, end };
  }
  return null;
}

/** Som's scenes wait during the wake window and Down Time (docs/STORY.md director rules). */
export function storyBusy(block: ClockBlock | null): boolean {
  return block?.key === "wake" || block?.key === "down";
}

/** How long after the saved day ends (its Sleep ends at the next wake target) to still wait. */
export const STALE_WAIT_MS = 2 * 60 * 60_000;

/**
 * Som's "busy" from the saved blocks (G7 R-C10). In a saved block: the wake window and Down Time
 * are busy. Just after the saved day ended (the next morning, before Today has saved the new day)
 * it's most likely the wake window, so scenes wait for up to STALE_WAIT_MS. Otherwise (nothing
 * saved, or long after) nothing is guessed.
 */
export function storyBusyAt(blocks: readonly SavedBlock[], now: Date): boolean {
  const cur = blockAt(blocks, now);
  if (cur) return storyBusy(cur);
  const ends = blocks.map((b) => new Date(b.end).getTime()).filter((t) => !Number.isNaN(t));
  if (ends.length === 0) return false;
  const last = Math.max(...ends);
  const t = now.getTime();
  return t >= last && t < last + STALE_WAIT_MS;
}

type BlockClockState = { blocks: SavedBlock[]; save: (blocks: SavedBlock[]) => void };

export const useBlockClock = create<BlockClockState>()(
  persist(
    (set) => ({
      blocks: [],
      save: (blocks) => set({ blocks }),
    }),
    { name: "247-block-clock", storage: createJSONStorage(() => localStorage) },
  ),
);
