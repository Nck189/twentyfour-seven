"use server";

import { slotFits } from "@/lib/share/freebusy";
import { loadShare, TOKEN_RE } from "@/lib/share/server";
import { adminClient } from "@/lib/supabase/admin";

export type AskResult = { ok: true } | { ok: false; reason: "notFree" | "tooMany" | "invalid" | "error" };

/**
 * A visitor asks for a slot (M12). The server recomputes the owner's free time and only sends the
 * request on when the whole slot lies inside one free interval (G7 R-M12-4); `request_slot` then
 * validates the text and rate-limits. The browser can't call either RPC itself.
 */
export async function askForSlot(input: {
  token: string;
  start: string;
  end: string;
  name: string;
  note: string;
}): Promise<AskResult> {
  const { token, name, note } = input ?? {};
  const start = new Date(input?.start);
  const end = new Date(input?.end);
  if (
    typeof token !== "string" ||
    !TOKEN_RE.test(token) ||
    typeof name !== "string" ||
    typeof note !== "string" ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  )
    return { ok: false, reason: "invalid" };
  const share = await loadShare(token, new Date());
  if (!share) return { ok: false, reason: "invalid" };
  const day = slotFits(share.days, start, end);
  if (!day) return { ok: false, reason: "notFree" };
  const db = adminClient();
  if (!db) return { ok: false, reason: "error" };
  const { error } = await db.rpc("request_slot", {
    p_token: token,
    p_day: day,
    p_start: start.toISOString(),
    p_end: end.toISOString(),
    p_name: name,
    p_note: note,
  });
  if (!error) return { ok: true };
  if (error.code === "P0001") return { ok: false, reason: "tooMany" };
  if (error.code === "22023" || error.code === "P0002") return { ok: false, reason: "invalid" };
  return { ok: false, reason: "error" };
}
