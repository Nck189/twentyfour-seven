/** Static economy numbers (SPEC §8.1). Server RPCs mirror these; tests check they match. */
import type { Priority } from "@/lib/backlog";

/** Coins for finishing a backlog item: Must > Should > Just start. */
export const COINS_BY_PRIORITY: Record<Priority, number> = {
  must: 30,
  should: 20,
  just_start: 10,
};
