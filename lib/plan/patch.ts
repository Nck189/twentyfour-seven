import type { SupabaseClient } from "@supabase/supabase-js";
import type { FixedEvent } from "@/content/defaults";
import type { DayPlanRow } from "@/lib/today/day";

type Fields = Partial<
  Pick<DayPlanRow, "template_id" | "attending" | "bedtime_override" | "late_night" | "mode">
>;

/**
 * Only what changed on a day (R-M3-4): top-level fields, whole per-block overrides for the blocks
 * touched, and the day's fixed events. Saved through patch_day_plan, which merges it into the row,
 * so edits from another device or screen aren't overwritten by a stale copy.
 */
export type DirtyDay = {
  set: Fields & { planned?: unknown };
  blocks?: Record<string, unknown>;
  fixedEvents?: FixedEvent[];
};

type Patch = Fields & { block?: { key: string }; fixed_events?: FixedEvent[] };

/** Adds an edit (already applied to `row`) to what's pending for that day. */
export function markDirty(prev: DirtyDay | undefined, patch: Patch, row: DayPlanRow): DirtyDay {
  const { block, fixed_events, ...fields } = patch;
  const next: DirtyDay = {
    set: { ...prev?.set, ...fields },
    blocks: prev?.blocks,
    fixedEvents: prev?.fixedEvents,
  };
  if (block) next.blocks = { ...next.blocks, [block.key]: row.overrides.blocks?.[block.key as never] ?? {} };
  if (fixed_events) next.fixedEvents = row.overrides.fixed_events ?? [];
  return next;
}

/** A failed save goes back under anything edited since (newer wins). */
export function requeue(failed: DirtyDay, newer: DirtyDay | undefined): DirtyDay {
  return {
    set: { ...failed.set, ...newer?.set },
    blocks: failed.blocks || newer?.blocks ? { ...failed.blocks, ...newer?.blocks } : undefined,
    fixedEvents: newer?.fixedEvents ?? failed.fixedEvents,
  };
}

/**
 * Saves a day's changes. Before the patch_day_plan migration is on the server, falls back to an
 * upsert of just the changed columns (+ the whole overrides when blocks/events changed).
 */
export async function saveDirty(
  client: SupabaseClient,
  userId: string,
  date: string,
  dirty: DirtyDay,
  row: DayPlanRow | undefined,
): Promise<boolean> {
  const { error } = await client.rpc("patch_day_plan", {
    p_date: date,
    p_set: dirty.set,
    p_blocks: dirty.blocks ?? null,
    p_fixed_events: dirty.fixedEvents ?? null,
  });
  if (!error) return true;
  if (error.code !== "PGRST202" && !/patch_day_plan/.test(error.message ?? "")) return false;
  const fallback: Record<string, unknown> = { user_id: userId, date, ...dirty.set };
  if ((dirty.blocks || dirty.fixedEvents) && row) fallback.overrides = row.overrides;
  const res = await client.from("day_plans").upsert(fallback, { onConflict: "user_id,date" });
  return !res.error;
}
