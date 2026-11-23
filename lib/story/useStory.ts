"use client";

import { useCallback, useEffect, useState } from "react";
import { isStoryBeatId, type StoryBeatId, type StoryGift } from "@/content/story";
import { nextBeat, type StoryMoment } from "@/lib/game/director";
import { notifyWalletChange } from "@/lib/market/changes";
import { getSupabase } from "@/lib/supabase/client";

export type PlayingBeat = { beat: StoryBeatId; gift: StoryGift | null };

type Status = {
  seen: string[];
  today: boolean;
  /** `day` = the seasonal calendar's date; `season_uses` = `<crop>:<season-year>` keys. */
  facts: {
    harvests: number;
    good_days: number;
    day?: string;
    season_uses?: string[];
    hatched?: number;
    best_streak?: number;
    days_used?: number;
    house?: number;
    perfect_days?: number;
    made?: number;
    welcome_backs?: number;
    festival_set?: boolean;
  };
};

/**
 * Story beats at a calm moment (docs/STORY.md). Asks the server what was seen, lets the pure
 * director pick, and claims the beat before it plays: the server re-checks the rules and grants
 * the gift, so a reload never replays it and a refusal plays nothing. Without the story tables
 * on the server (before the migration), nothing happens.
 */
/**
 * A beat the server has granted but the user hasn't watched to the end yet (G7 STORY-R1): kept
 * outside the component (and in localStorage, per user), so leaving the Farm while the claim is in
 * flight, or closing the app mid-scene, never loses it. It plays at the next calm visit and is
 * cleared only when the scene is done or skipped.
 */
const PENDING_KEY = "247-story-pending";
type Pending = PlayingBeat & { uid: string };

function readPending(): Pending | null {
  try {
    const v = typeof window === "undefined" ? null : window.localStorage.getItem(PENDING_KEY);
    const p = v ? (JSON.parse(v) as Pending) : null;
    return p && typeof p.uid === "string" && isStoryBeatId(p.beat) ? p : null;
  } catch {
    return null;
  }
}

function writePending(p: Pending | null): void {
  try {
    if (p) window.localStorage.setItem(PENDING_KEY, JSON.stringify(p));
    else window.localStorage.removeItem(PENDING_KEY);
  } catch {
    // Private mode / blocked storage: the beat still plays in this visit.
  }
}

export function useStory(moment: StoryMoment, busy = false) {
  const [playing, setPlaying] = useState<PlayingBeat | null>(null);
  /** The check for a beat is over (one plays, or none will): the farm can open other sheets. */
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (moment === "other" || busy) return;
    let cancelled = false;
    void (async () => {
      const client = getSupabase();
      const uid = (await client.auth.getSession()).data.session?.user.id;
      if (cancelled) return;
      if (!uid) return setChecked(true);
      const waiting = readPending();
      if (waiting?.uid === uid) {
        setPlaying({ beat: waiting.beat, gift: waiting.gift });
        setChecked(true);
        return;
      }
      const { data, error } = await client.rpc("story_status");
      if (cancelled) return;
      if (error || !data) return setChecked(true);
      const s = data as Status;
      const beat = nextBeat({
        moment,
        busy,
        seen: s.seen ?? [],
        seenToday: Boolean(s.today),
        facts: {
          harvests: s.facts?.harvests ?? 0,
          goodDays: s.facts?.good_days ?? 0,
          today: s.facts?.day,
          seasonUses: s.facts?.season_uses ?? [],
          hatched: s.facts?.hatched ?? 0,
          bestStreak: s.facts?.best_streak ?? 0,
          daysUsed: s.facts?.days_used ?? 0,
          house: s.facts?.house ?? 0,
          perfectDays: s.facts?.perfect_days ?? 0,
          made: s.facts?.made ?? 0,
          welcomeBacks: s.facts?.welcome_backs ?? 0,
          festivalSet: s.facts?.festival_set === true,
        },
      });
      if (cancelled) return;
      if (!beat) return setChecked(true);
      const claim = await client.rpc("claim_story_beat", { p_beat: beat });
      if (claim.error || !claim.data) return setChecked(true);
      const r = claim.data as { beat: string; gift: StoryGift | null };
      if (!isStoryBeatId(r.beat)) return setChecked(true);
      // Granted: keep it even if the user has left the Farm meanwhile (STORY-R1).
      writePending({ uid, beat: r.beat, gift: r.gift });
      if (r.gift) notifyWalletChange();
      if (!cancelled) {
        setPlaying({ beat: r.beat, gift: r.gift });
        setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [moment, busy]);

  const done = useCallback(() => {
    writePending(null);
    setPlaying(null);
  }, []);
  // A floated wish settles the beat: if the user leaves before Done, it doesn't replay (STORY-R22).
  const settle = useCallback(() => writePending(null), []);
  // Nothing to check here (another screen, or a busy moment): done at once.
  return { playing, done, settle, checked: checked || moment === "other" || busy };
}
