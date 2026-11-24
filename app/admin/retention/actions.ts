"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/stats/retentionServer";

/** The signed-in admin's id, or null (everyone else). Every action checks this first. */
async function adminId(): Promise<string | null> {
  const { data } = await (await getServerSupabase()).auth.getUser();
  return isAdminEmail(data.user?.email) ? (data.user?.id ?? null) : null;
}

/**
 * Invite-only on or off (docs/FRIENDS-DESIGN.md). Turning it on stamps `since` once: accounts made
 * before it keep their access; turning it off and on again keeps the first stamp.
 */
export async function setInviteOnly(on: boolean): Promise<boolean> {
  if (!(await adminId())) return false;
  const db = adminClient();
  if (!db) return false;
  const cur = await db.from("app_config").select("value").eq("key", "invite_only").maybeSingle();
  const since = (cur.data?.value as { since?: string | null } | undefined)?.since ?? new Date().toISOString();
  const r = await db
    .from("app_config")
    .upsert({ key: "invite_only", value: { on, since }, updated_at: new Date().toISOString() });
  revalidatePath("/admin/retention");
  return !r.error;
}

/** Minnie's own invite link has no limit (made if she has none yet). */
export async function makeMyInvitesUnlimited(): Promise<boolean> {
  const id = await adminId();
  const db = adminClient();
  if (!id || !db) return false;
  const r = await db
    .from("invite_links")
    .upsert(
      { user_id: id, token: randomBytes(24).toString("hex"), quota: null, active: true },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  if (r.error) return false;
  const u = await db.from("invite_links").update({ quota: null }).eq("user_id", id);
  revalidatePath("/admin/retention");
  return !u.error;
}
