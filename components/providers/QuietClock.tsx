"use client";

import { useEffect } from "react";
import { useNow } from "@/lib/hooks/useNow";
import { quietUntilFor } from "@/lib/sound/quiet";
import { setQuietUntil } from "@/lib/sound/sfx";
import { blockAt, useBlockClock } from "@/lib/today/blockClock";

/**
 * Auto-quiet on every screen (G7 STORY-R8): from the day's saved block times, sounds rest while the
 * current block is Focus or Work, even when the app opens straight on the Farm or More.
 */
export function QuietClock() {
  const now = useNow(30_000);
  const blocks = useBlockClock((s) => s.blocks);
  const until = now ? quietUntilFor(blockAt(blocks, now)) : 0;
  useEffect(() => {
    setQuietUntil(until);
  }, [until]);
  return null;
}
