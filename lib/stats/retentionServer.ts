import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";
import { localDate } from "@/lib/time";
import { retention, type Cohort } from "./retention";

/** Emails allowed to see the retention dashboard (server env, comma-separated; never public). */
export function isAdminEmail(email: string | null | undefined): boolean {
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return !!email && list.includes(email.toLowerCase());
}

/** G3: cohorts from every account (service role), for an allowed signed-in admin only; else null. */
export async function loadRetention(now: Date): Promise<{ cohorts: Cohort[]; users: number } | null> {
  const { data } = await (await getServerSupabase()).auth.getUser();
  if (!isAdminEmail(data.user?.email)) return null;
  const db = adminClient();
  if (!db) return null;
  const since = new Date(now.getTime() - 120 * 86_400_000).toISOString();
  const profiles = await db.from("profiles").select("user_id, timezone, created_at").gte("created_at", since);
  if (profiles.error) return null;
  const tz = new Map(
    (profiles.data ?? []).map((p) => [p.user_id as string, (p.timezone as string) || "Asia/Bangkok"]),
  );
  const active = new Map<string, Set<string>>();
  // Page through events (at most 1000 rows per request).
  for (let from = 0; ; from += 1000) {
    const ev = await db
      .from("events")
      .select("user_id, at")
      .gte("at", since)
      .order("at")
      .range(from, from + 999);
    if (ev.error) return null;
    for (const e of ev.data ?? []) {
      const id = e.user_id as string;
      if (!tz.has(id)) continue;
      const set = active.get(id) ?? new Set<string>();
      set.add(localDate(new Date(e.at as string), tz.get(id)!));
      active.set(id, set);
    }
    if ((ev.data ?? []).length < 1000) break;
  }
  const users = (profiles.data ?? []).map((p) => ({
    id: p.user_id as string,
    signup: localDate(new Date(p.created_at as string), tz.get(p.user_id as string)!),
  }));
  return { cohorts: retention(users, active, localDate(now, "Asia/Bangkok")), users: users.length };
}
