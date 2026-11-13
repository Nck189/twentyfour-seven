import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

/**
 * Server-only Supabase client with the service-role key (never sent to a browser: no NEXT_PUBLIC_
 * prefix, and `server-only` fails the build if a client component imports this). Used only for
 * token-checked RPCs that must not be callable from a browser (M12 share: the engine inputs and the
 * request RPC). Null when the key isn't set (the feature then shows "not found").
 */
export function adminClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
