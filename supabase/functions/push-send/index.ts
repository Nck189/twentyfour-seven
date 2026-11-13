// M11 Web Push sender (Supabase Edge Function, Deno). pg_cron calls it every minute with the
// service-role key (docs/M11-push-setup.md). Keys come from function secrets, never the repo:
// VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { deliver, type DueRow } from "./deliver.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  // Only the scheduler (service role) may trigger a send.
  if (req.headers.get("Authorization") !== `Bearer ${serviceKey}`) {
    return new Response("forbidden", { status: 403 });
  }
  const pub = Deno.env.get("VAPID_PUBLIC_KEY");
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT");
  if (!pub || !priv || !subject) return new Response("push not configured", { status: 503 });
  webpush.setVapidDetails(subject, pub, priv);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  // Claimed (marked sent) before sending: a parallel run or a slow device never sends twice.
  const { data, error } = await admin.rpc("push_claim", { p_limit: 200 });
  if (error) return new Response(error.message, { status: 500 });

  const result = await deliver((data ?? []) as DueRow[], {
    send: async (sub, payload) => {
      // Bounded: a slow or hanging push service can't stall the run (G7 R-M11-1).
      await webpush.sendNotification(sub, payload, { TTL: 600, urgency: "high", timeout: 10_000 });
    },
    dropEndpoint: async (endpoint) => {
      await admin.rpc("push_drop_endpoint", { p_endpoint: endpoint });
    },
  });
  return Response.json(result);
});
