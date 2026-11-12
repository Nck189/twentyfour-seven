/**
 * Story beats with Som, the orange farm cat (docs/STORY.md, Minnie 2026-11-12). Static, typed
 * content: each beat is unlocked by real progress, plays at a calm moment (lib/game/director.ts),
 * and its gift is granted by the server (`claim_story_beat`, which re-checks the trigger from
 * data). Lines are i18n keys under `story.<beat>.<line>`.
 */
import type { CropId } from "./crops";

export const STORY_BEATS = [
  "ch0_gate",
  "ch1_first_harvest",
  "ch2_watering_can",
  "ch3_new_friend",
  "ch4_sunset",
  "ch5_house",
  "ch6_album",
  // Som's café opens with the Farmhouse at level 2 (docs/STORY.md "Som's café").
  "cafe_open",
  // Seasonal crop beats (docs/STORY.md "Seasonal crops"): November, Candle Lotus.
  "lotus_open",
  "lotus_market",
  "lotus_use",
  // December, Snow Strawberry.
  "snow_open",
  "snow_market",
  "snow_use",
] as const;
export type StoryBeatId = (typeof STORY_BEATS)[number];

export const SOM_POSES = ["sit", "sleep", "stretch", "happy", "lookUp", "carrySeed"] as const;
export type SomPose = (typeof SOM_POSES)[number];

export type StoryScene =
  | "gate"
  | "field"
  | "shed"
  | "lotus_pond"
  | "water_market"
  | "krathong"
  | "snow_hill"
  | "winter_market"
  | "cake"
  | "pen"
  | "sunset"
  | "house"
  | "album"
  | "cafe";
/** Soft motion only: a slow pan, a small hop, or sparkles. With reduced motion, every panel is still. */
export type StoryMotion = "none" | "pan" | "hop" | "sparkle";

/** What has to be true in the data. The server checks the same thing (SQL `_story_ready`). */
export type StoryTrigger =
  | { kind: "always" }
  /** Harvests ever made (events of type `harvest`). */
  | { kind: "harvests"; need: number }
  /** Settled days that counted (day_results perfect or minimum). */
  | { kind: "good_days"; need: number }
  /**
   * A seasonal crop's month is now, on or after day `from` (1 = planting season opens, 15 = the
   * seasonal market). Once per crop per year; a month missed entirely waits for next year.
   */
  | { kind: "season"; crop: CropId; from: number }
  /** The first sale or delivery of a seasonal crop in its season-year. */
  | { kind: "season_use"; crop: CropId }
  /** Animals ever hatched. */
  | { kind: "hatched"; need: number }
  /** The best streak ever (game_state.best_streak). */
  | { kind: "best_streak"; need: number }
  /** Wake-days with an "I'm up" (days used, not a streak). */
  | { kind: "days_used"; need: number }
  /** The Farmhouse level. */
  | { kind: "house"; need: number };

export type StoryGift = { seed: { crop: CropId; n: number } } | { tickets: number } | { decor: "farm_sign" };

export type StoryPanel = {
  scene: StoryScene;
  pose: SomPose;
  line: string;
  motion: StoryMotion;
  /**
   * An optional, skippable form on this panel ("wish": float a private wish, ≤ WISH_MAX), or the
   * year in review from the user's own data ("review": the year-end cake, Snow Strawberry).
   */
  form?: "wish" | "review";
};

export type StoryBeat = {
  /** Sort order (unique). Seasonal beats are 7x: after the main chapters, like STORY.md's ch. 7. */
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
  ch3_new_friend: {
    chapter: 3,
    trigger: { kind: "hatched", need: 1 },
    panels: [
      { scene: "pen", pose: "lookUp", line: "l1", motion: "pan" },
      { scene: "pen", pose: "sit", line: "l2", motion: "none" },
      { scene: "pen", pose: "sleep", line: "l3", motion: "sparkle" },
    ],
    gift: null,
  },
  ch4_sunset: {
    chapter: 4,
    trigger: { kind: "best_streak", need: 7 },
    panels: [
      { scene: "sunset", pose: "stretch", line: "l1", motion: "pan" },
      { scene: "sunset", pose: "sit", line: "l2", motion: "none" },
      { scene: "sunset", pose: "happy", line: "l3", motion: "sparkle" },
    ],
    gift: { decor: "farm_sign" },
  },
  ch5_house: {
    chapter: 5,
    trigger: { kind: "house", need: 1 },
    panels: [
      { scene: "house", pose: "lookUp", line: "l1", motion: "pan" },
      { scene: "house", pose: "stretch", line: "l2", motion: "hop" },
      { scene: "house", pose: "sleep", line: "l3", motion: "none" },
    ],
    gift: null,
  },
  ch6_album: {
    chapter: 6,
    trigger: { kind: "days_used", need: 30 },
    panels: [
      { scene: "album", pose: "sit", line: "l1", motion: "pan" },
      { scene: "album", pose: "lookUp", line: "l2", motion: "sparkle" },
      { scene: "album", pose: "happy", line: "l3", motion: "none" },
    ],
    gift: { tickets: 2 },
  },
  cafe_open: {
    chapter: 9,
    trigger: { kind: "house", need: 2 },
    panels: [
      { scene: "cafe", pose: "carrySeed", line: "l1", motion: "pan" },
      { scene: "cafe", pose: "happy", line: "l2", motion: "sparkle" },
      { scene: "cafe", pose: "sit", line: "l3", motion: "none" },
    ],
    gift: null,
  },
  lotus_open: {
    chapter: 70,
    trigger: { kind: "season", crop: "candle_lotus", from: 1 },
    panels: [
      { scene: "lotus_pond", pose: "lookUp", line: "l1", motion: "pan" },
      { scene: "lotus_pond", pose: "sit", line: "l2", motion: "sparkle" },
      { scene: "lotus_pond", pose: "carrySeed", line: "l3", motion: "hop" },
    ],
    gift: { seed: { crop: "candle_lotus", n: 1 } },
  },
  lotus_market: {
    chapter: 71,
    trigger: { kind: "season", crop: "candle_lotus", from: 15 },
    panels: [
      { scene: "water_market", pose: "happy", line: "l1", motion: "pan" },
      { scene: "water_market", pose: "lookUp", line: "l2", motion: "sparkle" },
      { scene: "water_market", pose: "sit", line: "l3", motion: "none" },
    ],
    gift: null,
  },
  lotus_use: {
    chapter: 72,
    trigger: { kind: "season_use", crop: "candle_lotus" },
    panels: [
      { scene: "krathong", pose: "carrySeed", line: "l1", motion: "pan" },
      { scene: "krathong", pose: "sit", line: "l2", motion: "none" },
      { scene: "krathong", pose: "lookUp", line: "l3", motion: "none", form: "wish" },
      { scene: "krathong", pose: "happy", line: "l4", motion: "pan" },
    ],
    gift: null,
  },
  snow_open: {
    chapter: 80,
    trigger: { kind: "season", crop: "snow_strawberry", from: 1 },
    panels: [
      { scene: "snow_hill", pose: "lookUp", line: "l1", motion: "pan" },
      { scene: "snow_hill", pose: "sit", line: "l2", motion: "sparkle" },
      { scene: "snow_hill", pose: "carrySeed", line: "l3", motion: "hop" },
    ],
    gift: { seed: { crop: "snow_strawberry", n: 1 } },
  },
  snow_market: {
    chapter: 81,
    trigger: { kind: "season", crop: "snow_strawberry", from: 15 },
    panels: [
      { scene: "winter_market", pose: "happy", line: "l1", motion: "pan" },
      { scene: "winter_market", pose: "lookUp", line: "l2", motion: "sparkle" },
      { scene: "winter_market", pose: "sit", line: "l3", motion: "none" },
    ],
    gift: null,
  },
  snow_use: {
    chapter: 82,
    trigger: { kind: "season_use", crop: "snow_strawberry" },
    panels: [
      { scene: "cake", pose: "carrySeed", line: "l1", motion: "pan" },
      { scene: "cake", pose: "happy", line: "l2", motion: "sparkle" },
      { scene: "cake", pose: "sit", line: "l3", motion: "none", form: "review" },
      { scene: "winter_market", pose: "happy", line: "l4", motion: "sparkle" },
    ],
    gift: null,
  },
};

/** A floated wish is private and short (SQL `wishes` checks the same). */
export const WISH_MAX = 120;

/** Seasonal beats happen once per crop per year: the server records them as `<beat>:<year>`. */
export const isSeasonalBeat = (b: StoryBeatId): boolean => {
  const k = STORY[b].trigger.kind;
  return k === "season" || k === "season_use";
};

export const isStoryBeatId = (v: unknown): v is StoryBeatId =>
  typeof v === "string" && (STORY_BEATS as readonly string[]).includes(v);
