import { getSupabase } from "@/lib/supabase/client";

/** Appends an analytics/audit event for the signed-in user (events table is append-only). */
export async function logEvent(type: string, payload: Record<string, unknown> = {}) {
  const client = getSupabase();
  const { data } = await client.auth.getUser();
  if (!data.user) return;
  await client.from("events").insert({ user_id: data.user.id, type, payload });
}
