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
