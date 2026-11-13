"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { DEFAULT_PUSH_PREFS, type PushPrefs } from "./schedule";

/**
 * This device's notification state (M11):
 * - "unsupported": no Web Push here.
 * - "install": iPhone/iPad Safari tab — push needs the Home Screen app (iOS 16.4+).
 * - "off": not configured on the server yet (no VAPID public key in this build).
 * - "ask": can be turned on (permission is asked only after the user's tap).
 * - "on": subscribed. "blocked": the user said no in the browser/OS settings.
 */
export type PushState = "unsupported" | "install" | "off" | "ask" | "on" | "blocked";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIosTab(): boolean {
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

async function currentState(): Promise<PushState> {
  if (typeof window === "undefined") return "unsupported";
  if (isIosTab()) return "install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window))
    return "unsupported";
  if (!VAPID) return "off";
  if (Notification.permission === "denied") return "blocked";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "ask";
}

type ProfilePush = {
  push_block_start: boolean;
  push_first10: boolean;
  push_wake: boolean;
  push_night: boolean;
  push_quiet_start: string | null;
  push_quiet_end: string | null;
};
const toPrefs = (p: ProfilePush | null): PushPrefs =>
  p
    ? {
        block_start: p.push_block_start,
        first10: p.push_first10,
        wake: p.push_wake,
        night: p.push_night,
        quietStart: p.push_quiet_start,
        quietEnd: p.push_quiet_end,
      }
    : DEFAULT_PUSH_PREFS;

export function usePush() {
  const client = getSupabase();
  const [state, setState] = useState<PushState | null>(null);
  const [prefs, setPrefs] = useState<PushPrefs | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [s, p] = await Promise.all([
        currentState().catch(() => "unsupported" as const),
        client
          .from("profiles")
          .select("push_block_start, push_first10, push_wake, push_night, push_quiet_start, push_quiet_end")
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setState(s);
      setPrefs(p.error ? DEFAULT_PUSH_PREFS : toPrefs(p.data as ProfilePush | null));
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  /** Call only from a user tap (iOS requires it for the permission prompt). */
  const turnOn = useCallback(async (): Promise<PushState> => {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        const s = perm === "denied" ? "blocked" : "ask";
        setState(s);
        return s;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID) }));
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      const r = await client.rpc("save_push_subscription", {
        p_endpoint: json.endpoint ?? sub.endpoint,
        p_p256dh: json.keys?.p256dh ?? "",
        p_auth: json.keys?.auth ?? "",
      });
      const s = r.error ? "ask" : "on";
      setState(s);
      return s;
    } catch {
      setState("ask");
      return "ask";
    }
  }, [client]);

  const turnOff = useCallback(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await client.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe().catch(() => false);
    }
    // Every meaningful action leaves an events row (CLAUDE.md; G7 R-M11-10).
    const { data: auth } = await client.auth.getUser();
    if (auth.user)
      await client.from("events").insert({ user_id: auth.user.id, type: "push_turned_off", payload: {} });
    setState("ask");
  }, [client]);

  const savePrefs = useCallback(
    async (next: PushPrefs): Promise<boolean> => {
      const { data: auth } = await client.auth.getUser();
      if (!auth.user) return false;
      const r = await client
        .from("profiles")
        .update({
          push_block_start: next.block_start,
          push_first10: next.first10,
          push_wake: next.wake,
          push_night: next.night,
          push_quiet_start: next.quietStart,
          push_quiet_end: next.quietEnd,
        })
        .eq("user_id", auth.user.id);
      if (!r.error) {
        setPrefs(next);
        await client.from("events").insert({
          user_id: auth.user.id,
          type: "push_prefs_changed",
          payload: { ...next },
        });
      }
      return !r.error;
    },
    [client],
  );

  return { state, prefs, turnOn, turnOff, savePrefs };
}
