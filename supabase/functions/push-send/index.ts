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
  const { data, error } = await admin.rpc("push_due", { p_limit: 500 });
  if (error) return new Response(error.message, { status: 500 });

  const result = await deliver((data ?? []) as DueRow[], {
    send: async (sub, payload) => {
      await webpush.sendNotification(sub, payload, { TTL: 600, urgency: "high" });
    },
    dropEndpoint: async (endpoint) => {
      await admin.rpc("push_drop_endpoint", { p_endpoint: endpoint });
    },
    markSent: async (user, ref) => {
      await admin.rpc("push_mark_sent", { p_user: user, p_ref: ref });
    },
  });
  return Response.json(result);
});
