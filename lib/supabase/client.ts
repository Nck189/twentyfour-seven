"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";
import { dedupeGets, fetchWithTimeout } from "./fetchWithTimeout";

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
      global: { fetch: dedupeGets(fetchWithTimeout()) },
      db: { retry: false },
    });
  return client;
}

let userPromise: Promise<User | null> | null = null;
let listening = false;

/**
 * The signed-in user, verified once per page and shared: Today's hooks each asked the auth server
 * (`/auth/v1/user` 7× per load, task #41). Any auth change (sign in/out, token refresh, user update)
 * starts fresh; a signed-out or failed answer is never cached. Same shape as `auth.getUser()`.
 */
export async function getUserCached(): Promise<{ data: { user: User | null } }> {
  const c = getSupabase();
  if (!listening) {
    listening = true;
    c.auth.onAuthStateChange(() => {
      userPromise = null;
    });
  }
  // The local session (no network) says who is signed in on this device right now; a cached user
  // for anyone else is dropped, even if no auth event reached this tab (G7 PERF P-3).
  const {
    data: { session },
  } = await c.auth.getSession();
  const localId = session?.user?.id ?? null;
  if (!localId) {
    userPromise = null;
    return { data: { user: null } };
  }
  if (userPromise) {
    const cached = await userPromise;
    if (cached && cached.id !== localId) userPromise = null;
  }
  if (!userPromise) {
    const p = c.auth
      .getUser()
      .then((r) => r.data.user ?? null)
      .catch(() => null);
    userPromise = p;
    p.then((u) => {
      if (!u && userPromise === p) userPromise = null;
    });
  }
  return { data: { user: await userPromise } };
}
