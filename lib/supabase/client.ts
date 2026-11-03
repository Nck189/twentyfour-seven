"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";
import { fetchWithTimeout } from "./fetchWithTimeout";

let client: SupabaseClient | null = null;

/**
 * Singleton browser client. RLS is the security boundary for every query it makes.
 * supabase-js's own GET retries (1 s + 2 s + 4 s, and it even retries our timeout) are off: the
 * app has one explicit policy instead — a request fails after 15 s, a first load retries once
 * quietly, then shows "Couldn't load" with Try again, and failed saves stay queued.
 */
export function getSupabase(): SupabaseClient {
  if (!client)
    client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { fetch: fetchWithTimeout() },
      db: { retry: false },
    });
  return client;
}
