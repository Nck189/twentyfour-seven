"use client";

import { useCallback, useEffect, useState } from "react";
import { isStoryBeatId, type StoryBeatId, type StoryGift } from "@/content/story";
import { nextBeat, type StoryMoment } from "@/lib/game/director";
import { notifyWalletChange } from "@/lib/market/changes";
import { getSupabase } from "@/lib/supabase/client";

export type PlayingBeat = { beat: StoryBeatId; gift: StoryGift | null };

type Status = { seen: string[]; today: boolean; facts: { harvests: number; good_days: number } };

/**
 * Story beats at a calm moment (docs/STORY.md). Asks the server what was seen, lets the pure
 * director pick, and claims the beat before it plays: the server re-checks the rules and grants
 * the gift, so a reload never replays it and a refusal plays nothing. Without the story tables
 * on the server (before the migration), nothing happens.
 */
export function useStory(moment: StoryMoment, busy = false) {
  const [playing, setPlaying] = useState<PlayingBeat | null>(null);

  useEffect(() => {
    if (moment === "other" || busy) return;
    let cancelled = false;
    void (async () => {
      const client = getSupabase();
      const { data, error } = await client.rpc("story_status");
      if (cancelled || error || !data) return;
      const s = data as Status;
      const beat = nextBeat({
        moment,
        busy,
        seen: s.seen ?? [],
        seenToday: Boolean(s.today),
        facts: { harvests: s.facts?.harvests ?? 0, goodDays: s.facts?.good_days ?? 0 },
      });
      if (!beat) return;
      const claim = await client.rpc("claim_story_beat", { p_beat: beat });
      if (cancelled || claim.error || !claim.data) return;
      const r = claim.data as { beat: string; gift: StoryGift | null };
      if (!isStoryBeatId(r.beat)) return;
      if (r.gift) notifyWalletChange();
      setPlaying({ beat: r.beat, gift: r.gift });
    })();
    return () => {
      cancelled = true;
    };
  }, [moment, busy]);

  const done = useCallback(() => setPlaying(null), []);
  return { playing, done };
}
