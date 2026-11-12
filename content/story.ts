/**
 * Story beats with Som, the orange farm cat (docs/STORY.md, Minnie 2026-11-12). Static, typed
 * content: each beat is unlocked by real progress, plays at a calm moment (lib/game/director.ts),
 * and its gift is granted by the server (`claim_story_beat`, which re-checks the trigger from
 * data). Lines are i18n keys under `story.<beat>.<line>`.
 */
import type { CropId } from "./crops";

export const STORY_BEATS = ["ch0_gate", "ch1_first_harvest", "ch2_watering_can"] as const;
export type StoryBeatId = (typeof STORY_BEATS)[number];

export const SOM_POSES = ["sit", "sleep", "stretch", "happy", "lookUp", "carrySeed"] as const;
export type SomPose = (typeof SOM_POSES)[number];

export type StoryScene = "gate" | "field" | "shed";
/** Soft motion only: a slow pan, a small hop, or sparkles. With reduced motion, every panel is still. */
export type StoryMotion = "none" | "pan" | "hop" | "sparkle";

/** What has to be true in the data. The server checks the same thing (SQL `_story_ready`). */
export type StoryTrigger =
  | { kind: "always" }
  /** Harvests ever made (events of type `harvest`). */
  | { kind: "harvests"; need: number }
  /** Settled days that counted (day_results perfect or minimum). */
  | { kind: "good_days"; need: number };

export type StoryGift = { seed: { crop: CropId; n: number } } | { tickets: number };

export type StoryPanel = { scene: StoryScene; pose: SomPose; line: string; motion: StoryMotion };

export type StoryBeat = {
  chapter: number;
  trigger: StoryTrigger;
  panels: StoryPanel[];
  gift: StoryGift | null;
};

export const STORY: Record<StoryBeatId, StoryBeat> = {
  ch0_gate: {
    chapter: 0,
    trigger: { kind: "always" },
    panels: [
      { scene: "gate", pose: "sleep", line: "l1", motion: "pan" },
      { scene: "gate", pose: "stretch", line: "l2", motion: "none" },
      { scene: "gate", pose: "lookUp", line: "l3", motion: "hop" },
      { scene: "field", pose: "happy", line: "l4", motion: "sparkle" },
    ],
    gift: null,
  },
  ch1_first_harvest: {
    chapter: 1,
    trigger: { kind: "harvests", need: 1 },
    panels: [
      { scene: "field", pose: "sit", line: "l1", motion: "pan" },
      { scene: "field", pose: "lookUp", line: "l2", motion: "none" },
      { scene: "field", pose: "carrySeed", line: "l3", motion: "hop" },
    ],
    gift: { seed: { crop: "radish", n: 1 } },
  },
  ch2_watering_can: {
    chapter: 2,
    trigger: { kind: "good_days", need: 3 },
    panels: [
      { scene: "shed", pose: "stretch", line: "l1", motion: "pan" },
      { scene: "shed", pose: "sit", line: "l2", motion: "none" },
      { scene: "field", pose: "happy", line: "l3", motion: "sparkle" },
    ],
    gift: { tickets: 1 },
  },
};

export const isStoryBeatId = (v: unknown): v is StoryBeatId =>
  typeof v === "string" && (STORY_BEATS as readonly string[]).includes(v);
