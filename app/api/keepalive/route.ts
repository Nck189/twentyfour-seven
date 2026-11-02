import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/**
 * Daily keep-alive (Vercel cron). Supabase free projects pause after ~1 week idle,
 * so this runs one tiny DB query via the public `keepalive()` RPC.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/keepalive`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: "{}",
    cache: "no-store",
  });
  return NextResponse.json({ ok: res.ok, status: res.status }, { status: res.ok ? 200 : 502 });
}
