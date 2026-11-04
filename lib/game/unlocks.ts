/**
 * Unlock ladder progress (SPEC §8.8b): pure. The counts come from the server (`claim_unlocks`
 * computes them from the data); this turns them into progress rings and the "next" line.
 */
import { UNLOCK_IDS, UNLOCKS, type UnlockId, type UnlockMetric } from "@/content/unlocks";

/** `streak` (the current one) shows how far a streak goal still is; it's paid on `best_streak`. */
export type UnlockCounts = Record<UnlockMetric, number> & { streak: number };
export type UnlockProgress = { id: UnlockId; have: number; need: number; done: boolean; left: number };

export function unlockProgress(
  counts: Partial<UnlockCounts>,
  granted: readonly string[] = [],
): UnlockProgress[] {
  return UNLOCK_IDS.map((id) => {
    const u = UNLOCKS[id];
    const reached = Math.max(0, counts[u.metric] ?? 0);
    const done = granted.includes(id) || reached >= u.need;
    // Not earned yet: a streak goal needs a streak that long from here (R-M9-7).
    const raw = !done && u.metric === "best_streak" && counts.streak !== undefined ? counts.streak : reached;
    const have = done ? u.need : Math.min(u.need, Math.max(0, raw));
    return { id, have, need: u.need, done, left: done ? 0 : u.need - have };
  });
}

/** The closest unlock not yet earned (fewest left, then smallest goal): Today's one quiet line. */
export function nextUnlock(progress: readonly UnlockProgress[]): UnlockProgress | null {
  const open = progress.filter((p) => !p.done);
  if (open.length === 0) return null;
  return [...open].sort((a, b) => a.left / a.need - b.left / b.need || a.need - b.need)[0]!;
}
