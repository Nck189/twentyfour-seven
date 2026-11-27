"use client";

import type { BlockKey, BlockSetting } from "@/content/blocks";
import { logEvent } from "@/lib/db/events";
import { getSupabase, getUserCached } from "@/lib/supabase/client";

/**
 * Saves which optional blocks are tracked (rule B). Reads the latest saved blocks first, so an
 * edit made elsewhere since (Plan's defaults, another device) isn't undone; only `tracked` moves.
 */
export async function saveTracked(changes: Partial<Record<BlockKey, boolean>>): Promise<BlockSetting[]> {
  const user = (await getUserCached()).data.user;
  if (!user) throw new Error("signed out");
  const client = getSupabase();
  const fresh = await client.from("settings").select("blocks").eq("user_id", user.id).single();
  if (fresh.error) throw fresh.error;
  const blocks = (fresh.data.blocks as BlockSetting[]).map((b) =>
    b.key in changes ? { ...b, tracked: changes[b.key] } : b,
  );
  const { error } = await client.from("settings").update({ blocks }).eq("user_id", user.id);
  if (error) throw error;
  void logEvent("blocks_tracked_set", {
    untracked: blocks.filter((b) => b.tracked === false).map((b) => b.key),
  });
  return blocks;
}

export async function loadBlocks(): Promise<BlockSetting[] | null> {
  const user = (await getUserCached()).data.user;
  if (!user) return null;
  const { data } = await getSupabase().from("settings").select("blocks").eq("user_id", user.id).maybeSingle();
  return (data?.blocks as BlockSetting[] | undefined) ?? null;
}
