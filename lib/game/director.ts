/**
 * The story director (docs/STORY.md): pure. Picks the beat to play now, or none.
 * - At most one beat a day (wake-day), never the same beat twice.
 * - Only at calm moments: opening the Farm, or right after Goodnight; never while busy
 *   (wake window, Down Time, a running block's check-in).
 * - A beat waits for its trigger in the data; nothing is time-limited, so a missed moment just
 *   plays at the next calm one. The server re-checks all of this in `claim_story_beat`.
 * - Seasonal beats (docs/STORY.md "Seasonal crops") are once per crop per year: their key is
 *   `<beat>:<season-year>`. The opening and market beats play in their crop's month; a month
 *   missed entirely comes back next year (no FOMO: the crop returns too).
 */
import { STORY, STORY_BEATS, isSeasonalBeat, type StoryBeatId, type StoryTrigger } from "@/content/story";
import { seasonMonthOf } from "@/content/seasonal";
import { seasonYear } from "./seasonal";

export type StoryFacts = {
  harvests: number;
  goodDays: number;
  /** The seasonal calendar's date (the user's wake-day, YYYY-MM-DD). */
  today?: string;
  /** Seasonal crops sold or delivered, as `<crop>:<season-year>`. */
  seasonUses?: readonly string[];
};
export type StoryMoment = "farm" | "goodnight" | "other";

export function triggerMet(t: StoryTrigger, f: StoryFacts): boolean {
  switch (t.kind) {
    case "always":
      return true;
    case "harvests":
      return f.harvests >= t.need;
    case "good_days":
      return f.goodDays >= t.need;
    case "season":
      return (
        f.today !== undefined &&
        Number(f.today.slice(5, 7)) === seasonMonthOf(t.crop) &&
        Number(f.today.slice(8, 10)) >= t.from
      );
    case "season_use":
      return (
        f.today !== undefined && (f.seasonUses ?? []).includes(`${t.crop}:${seasonYear(t.crop, f.today)}`)
      );
  }
}

/** The key the server records a beat under: the beat id, or `<beat>:<season-year>` if seasonal. */
export function beatKey(beat: StoryBeatId, today: string | undefined): string | null {
  if (!isSeasonalBeat(beat)) return beat;
  const t = STORY[beat].trigger;
  if (today === undefined || (t.kind !== "season" && t.kind !== "season_use")) return null;
  return `${beat}:${seasonYear(t.crop, today)}`;
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
  return (
    order.find((b) => {
      const key = beatKey(b, input.facts.today);
      return key !== null && !input.seen.includes(key) && triggerMet(STORY[b].trigger, input.facts);
    }) ?? null
  );
}
