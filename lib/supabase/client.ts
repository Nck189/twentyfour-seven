"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";
import { fetchWithTimeout } from "./fetchWithTimeout";

let client: SupabaseClient | null = null;

/** Singleton browser client. RLS is the security boundary for every query it makes. */
export function getSupabase(): SupabaseClient {
  if (!client)
    client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { fetch: fetchWithTimeout() },
    });
  return client;
}
