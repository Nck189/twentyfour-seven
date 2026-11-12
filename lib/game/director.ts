/**
 * The story director (docs/STORY.md): pure. Picks the beat to play now, or none.
 * - At most one beat a day (wake-day), never the same beat twice.
 * - Only at calm moments: opening the Farm, or right after Goodnight; never while busy
 *   (wake window, Down Time, a running block's check-in).
 * - A beat waits for its trigger in the data; nothing is time-limited, so a missed moment just
 *   plays at the next calm one. The server re-checks all of this in `claim_story_beat`.
 */
import { STORY, STORY_BEATS, type StoryBeatId, type StoryTrigger } from "@/content/story";

export type StoryFacts = { harvests: number; goodDays: number };
export type StoryMoment = "farm" | "goodnight" | "other";

export function triggerMet(t: StoryTrigger, f: StoryFacts): boolean {
  switch (t.kind) {
    case "always":
      return true;
    case "harvests":
      return f.harvests >= t.need;
    case "good_days":
      return f.goodDays >= t.need;
  }
}

export function nextBeat(input: {
  moment: StoryMoment;
  busy: boolean;
  seen: readonly string[];
  seenToday: boolean;
  facts: StoryFacts;
}): StoryBeatId | null {
  if (input.moment === "other" || input.busy || input.seenToday) return null;
  const order = [...STORY_BEATS].sort((a, b) => STORY[a].chapter - STORY[b].chapter);
  return order.find((b) => !input.seen.includes(b) && triggerMet(STORY[b].trigger, input.facts)) ?? null;
}
