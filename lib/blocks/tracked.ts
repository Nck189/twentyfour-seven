"use client";

import type { BlockKey, BlockSetting } from "@/content/blocks";
import { getSupabase, getUserCached } from "@/lib/supabase/client";

/**
 * Tracks a block or not (rule B) through the server, which dates the change from the next
 * wake-day (`now`: from today, only while the account is under a day old, i.e. during setup) and
 * logs the event. Returns the saved blocks.
 */
export async function saveTracked(block: BlockKey, tracked: boolean, now = false): Promise<BlockSetting[]> {
  const { data, error } = await getSupabase().rpc("set_block_tracked", {
    p_block: block,
    p_tracked: tracked,
    p_now: now,
  });
  if (error) throw error;
  return data as BlockSetting[];
}

export async function loadBlocks(): Promise<BlockSetting[] | null> {
  const user = (await getUserCached()).data.user;
  if (!user) return null;
  const { data, error } = await getSupabase()
    .from("settings")
    .select("blocks")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return (data?.blocks as BlockSetting[] | undefined) ?? null;
}
