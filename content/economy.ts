/** Static economy numbers (SPEC §8.1). Server RPCs mirror these; tests check they match. */
import type { Priority } from "@/lib/backlog";

/** Coins for finishing a backlog item: Must > Should > Just start. */
export const COINS_BY_PRIORITY: Record<Priority, number> = {
  must: 30,
  should: 20,
  just_start: 10,
};

/**
 * Anti-farming (SPEC §0.6, G7 R-M5-1): a task finished within this many minutes of being added,
 * or of its priority being raised, pays only QUICK_FINISH_COINS. Server: complete_backlog_item.
 */
export const QUICK_FINISH_MIN = 10;
export const QUICK_FINISH_COINS = COINS_BY_PRIORITY.just_start;
/** At most this many backlog coins per local day. */
export const BACKLOG_DAILY_COIN_CAP = 150;
