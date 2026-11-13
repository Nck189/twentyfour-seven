import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ShareView } from "@/components/share/ShareView";
import { contextFrom, freeDaysFromContext, type ShareContext } from "@/lib/share/compute";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/**
 * Someone's free times (M12, SPEC §9): `/share/<secret>`, no login. The free/busy is computed here
 * on the server from `share_context` (no titles, tasks or first-10s); the browser only ever gets
 * the free intervals. An unknown link is a plain 404.
 */
export const metadata = { robots: { index: false, follow: false } };

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={null}>
      <Share params={params} />
    </Suspense>
  );
}

async function Share({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const token = (await params).token;
  if (!/^[0-9a-f]{48}$/.test(token)) notFound();
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data } = await client.rpc("share_context", { p_token: token });
  const c = data as ShareContext | null;
  if (!c || !c.settings) notFound();
  let days: { date: string; free: { start: string; end: string }[] }[] = [];
  try {
    days = freeDaysFromContext(contextFrom({ ...c, settings: c.settings }), new Date()).map((d) => ({
      date: d.date,
      free: d.free.map((i) => ({ start: i.start.toISOString(), end: i.end.toISOString() })),
    }));
  } catch {
    days = [];
  }
  return <ShareView token={token} name={c.name} timezone={c.timezone} days={days} />;
}
