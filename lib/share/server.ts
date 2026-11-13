import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { contextFrom, freeDaysFromContext, type ShareContext } from "./compute";
import type { DayFree } from "./freebusy";

export const TOKEN_RE = /^[0-9a-f]{48}$/;

/**
 * A share link's free time, computed on the server (G7 R-M12-1): the engine inputs never leave
 * it; callers get the owner's display name, timezone and the free intervals only.
 */
export async function loadShare(
  token: string,
  now: Date,
): Promise<{ name: string | null; timezone: string; days: DayFree[] } | null> {
  if (!TOKEN_RE.test(token)) return null;
  const db = adminClient();
  if (!db) return null;
  const { data, error } = await db.rpc("share_context", { p_token: token });
  const c = data as ShareContext | null;
  if (error || !c || !c.settings) return null;
  let days: DayFree[];
  try {
    days = freeDaysFromContext(contextFrom({ ...c, settings: c.settings }), now);
  } catch {
    days = [];
  }
  return { name: c.name, timezone: c.timezone, days };
}
