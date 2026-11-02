import { existsSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Next skips .env.local when NODE_ENV=test, so load it directly (CI sets real env vars instead).
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
export const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const admin = () => createClient(URL, SERVICE, { auth: { persistSession: false } });
export const anon = () => createClient(URL, ANON, { auth: { persistSession: false } });

/** Creates a fresh confirmed user and returns a client signed in as them. */
export async function newUser(tag: string): Promise<{ client: SupabaseClient; id: string; email: string }> {
  const email = `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.local`;
  const password = `pw-${Math.random().toString(36).slice(2)}-X1`;
  const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  const client = anon();
  const { error: signErr } = await client.auth.signInWithPassword({ email, password });
  if (signErr) throw signErr;
  return { client, id: data.user.id, email };
}
