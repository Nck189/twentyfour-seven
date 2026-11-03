/**
 * Setup rewards (SPEC §8.8c): each one-time setup step pays a small reward once, granted by the
 * server when the setting exists in the data (`claim_setup_rewards`, M7 setup migration — a unit
 * test checks the SQL mirrors these numbers). Bigger setups pay more. New features add their own
 * row when they ship (exercise goal → M8, notifications → M11).
 */
import type { CropId } from "./crops";
import type { DecorId } from "./decor";

export type Reward =
  { tickets: number } | { coins: number } | { seed: { crop: CropId; n: number } } | { decor: DecorId };

export const SETUP_STEPS = [
  "sleep_times",
  "first10",
  "checklist",
  "backlog_estimate",
  "language",
  "home_screen",
] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

export const SETUP_REWARD: Record<SetupStep, Reward> = {
  sleep_times: { seed: { crop: "strawberry", n: 2 } },
  first10: { tickets: 1 },
  checklist: { coins: 20 },
  backlog_estimate: { coins: 15 },
  language: { coins: 5 },
  home_screen: { decor: "flowers" },
};

/** Where each step is set up in the app. */
export const SETUP_HREF: Record<SetupStep, string> = {
  sleep_times: "/welcome?step=week&from=more",
  first10: "/welcome?step=first10&from=more",
  checklist: "/plan",
  backlog_estimate: "/plan",
  language: "/more#language",
  home_screen: "/more#install",
};

export const isSetupStep = (v: unknown): v is SetupStep =>
  typeof v === "string" && (SETUP_STEPS as readonly string[]).includes(v);
