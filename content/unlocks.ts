/**
 * Setup rewards (SPEC §8.8c): each one-time setup step pays a small reward once, granted by the
 * server when the setting exists in the data (`claim_setup_rewards`, M7 setup migration — a unit
 * test checks the SQL mirrors these numbers). Bigger setups pay more. New features add their own
 * row when they ship (exercise goal + gym close: M8; notifications: M11).
 */
import type { CropId } from "./crops";
import type { DecorId } from "./decor";

export type Reward =
  | { tickets: number }
  | { coins: number }
  | { seed: { crop: CropId; n: number } }
  | { decor: DecorId }
  | { feed: number }
  /** An animal egg: hatches at once (server roll, like a workout egg). */
  | { egg: 1 };

export const SETUP_STEPS = [
  "sleep_times",
  "first10",
  "checklist",
  "backlog_estimate",
  "language",
  "home_screen",
  "exercise",
  "notifications",
] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

export const SETUP_REWARD: Record<SetupStep, Reward> = {
  sleep_times: { seed: { crop: "strawberry", n: 2 } },
  first10: { tickets: 1 },
  checklist: { coins: 20 },
  backlog_estimate: { coins: 15 },
  language: { coins: 5 },
  home_screen: { decor: "flowers" },
  exercise: { feed: 3 },
  notifications: { decor: "wind_chime" },
};

/** Where each step is set up in the app. */
export const SETUP_HREF: Record<SetupStep, string> = {
  sleep_times: "/welcome?step=week&from=more",
  first10: "/welcome?step=first10&from=more",
  checklist: "/plan",
  backlog_estimate: "/plan",
  language: "/more#language",
  home_screen: "/more#install",
  exercise: "/more#exercise",
  notifications: "/more#notifications",
};

export const isSetupStep = (v: unknown): v is SetupStep =>
  typeof v === "string" && (SETUP_STEPS as readonly string[]).includes(v);

/**
 * Unlock ladder (SPEC §8.8b): small firsts, weekly counts, monthly farm-changers. Each pays once
 * into the same `unlock_grants` ledger, granted by `claim_unlocks` when the count in the data
 * reaches `need` (progress = `lib/game/unlocks.ts`). Mirrored in SQL with a test.
 */
export const UNLOCK_IDS = [
  "first_night",
  "first_backlog",
  "all_first10_day",
  "first10_20",
  "must_10",
  "streak_7",
  "streak_30",
  "blocks_100",
] as const;
export type UnlockId = (typeof UNLOCK_IDS)[number];
export type UnlockTier = "small" | "medium" | "big";
/** What each unlock counts (all server facts or guarded logs). */
export type UnlockMetric =
  "nights" | "backlog_done" | "all_first10_days" | "first10s" | "must_done" | "best_streak" | "blocks_closed";

export const UNLOCKS: Record<
  UnlockId,
  { tier: UnlockTier; metric: UnlockMetric; need: number; reward: Reward }
> = {
  first_night: { tier: "small", metric: "nights", need: 1, reward: { decor: "garden_lantern" } },
  first_backlog: { tier: "small", metric: "backlog_done", need: 1, reward: { decor: "mailbox" } },
  all_first10_day: {
    tier: "small",
    metric: "all_first10_days",
    need: 1,
    reward: { seed: { crop: "sunflower", n: 1 } },
  },
  first10_20: { tier: "medium", metric: "first10s", need: 20, reward: { tickets: 2 } },
  must_10: { tier: "medium", metric: "must_done", need: 10, reward: { coins: 50 } },
  streak_7: { tier: "medium", metric: "best_streak", need: 7, reward: { egg: 1 } },
  streak_30: { tier: "big", metric: "best_streak", need: 30, reward: { decor: "pond" } },
  blocks_100: { tier: "big", metric: "blocks_closed", need: 100, reward: { coins: 150 } },
};

export const isUnlockId = (v: unknown): v is UnlockId =>
  typeof v === "string" && (UNLOCK_IDS as readonly string[]).includes(v);

/** Feature reveals (SPEC §8.8b): a new user's screens stay calm until these are earned. */
export const REVEALS = { statsAfterDays: 3 } as const;
