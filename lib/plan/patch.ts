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
  /** Appointments added / removed one by one (R2-5: never the whole list). */
  addEvents?: FixedEvent[];
  removeEventIds?: string[];
};

type Patch = Fields & { block?: { key: string }; add_event?: FixedEvent; remove_event?: string };

/** Adds an edit (already applied to `row`) to what's pending for that day. */
export function markDirty(prev: DirtyDay | undefined, patch: Patch, row: DayPlanRow): DirtyDay {
  const { block, add_event, remove_event, ...fields } = patch;
  const next: DirtyDay = {
    set: { ...prev?.set, ...fields },
    blocks: prev?.blocks,
    addEvents: prev?.addEvents,
    removeEventIds: prev?.removeEventIds,
  };
  if (block) next.blocks = { ...next.blocks, [block.key]: row.overrides.blocks?.[block.key as never] ?? {} };
  if (add_event) next.addEvents = [...(next.addEvents ?? []), add_event];
  if (remove_event) {
    // Removing one that was only added here (not saved yet) just cancels the add.
    const local = next.addEvents?.some((e) => e.id === remove_event);
    next.addEvents = next.addEvents?.filter((e) => e.id !== remove_event);
    if (!local) next.removeEventIds = [...(next.removeEventIds ?? []), remove_event];
  }
  return next;
}

/** A failed save goes back under anything edited since (newer wins). */
export function requeue(failed: DirtyDay, newer: DirtyDay | undefined): DirtyDay {
  const removedLater = new Set(newer?.removeEventIds ?? []);
  const adds = [
    ...(failed.addEvents ?? []).filter((e) => !removedLater.has(e.id)),
    ...(newer?.addEvents ?? []),
  ];
  const removes = [...(failed.removeEventIds ?? []), ...(newer?.removeEventIds ?? [])];
  return {
    set: { ...failed.set, ...newer?.set },
    blocks: failed.blocks || newer?.blocks ? { ...failed.blocks, ...newer?.blocks } : undefined,
    addEvents: adds.length ? adds : undefined,
    removeEventIds: removes.length ? removes : undefined,
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
    p_add_events: dirty.addEvents?.length ? dirty.addEvents : null,
    p_remove_event_ids: dirty.removeEventIds?.length ? dirty.removeEventIds : null,
  });
  if (!error) return true;
  if (error.code !== "PGRST202" && !/patch_day_plan/.test(error.message ?? "")) return false;
  const fallback: Record<string, unknown> = { user_id: userId, date, ...dirty.set };
  if ((dirty.blocks || dirty.addEvents || dirty.removeEventIds) && row) fallback.overrides = row.overrides;
  const res = await client.from("day_plans").upsert(fallback, { onConflict: "user_id,date" });
  return !res.error;
}
