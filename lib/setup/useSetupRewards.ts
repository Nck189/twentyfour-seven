"use client";

import { useCallback, useEffect, useState } from "react";
import { isSetupStep, type SetupStep } from "@/content/unlocks";
import { getSupabase } from "@/lib/supabase/client";

export type SetupRewards = { done: SetupStep[]; granted: SetupStep[] };

/**
 * Setup rewards (SPEC §8.8c): asks the server to pay every step that's set up and not yet paid,
 * and returns which steps are done. The server decides from the data; nothing here grants.
 */
export function useSetupRewards() {
  const client = getSupabase();
  const [state, setState] = useState<SetupRewards | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await client.rpc("claim_setup_rewards");
      if (cancelled || error || !data) return;
      const d = data as { done: unknown[]; granted: unknown[] };
      setState({ done: d.done.filter(isSetupStep), granted: d.granted.filter(isSetupStep) });
    })();
    return () => {
      cancelled = true;
    };
  }, [client, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { state, reload };
}

/** True when this launch came from the Home Screen (installed PWA). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches === true;
}

const REPORTED = "24-7:home-screen-reported";

/** The first Home Screen launch tells the server once (the device's word; small, one-time reward). */
export async function reportHomeScreenOnce(): Promise<void> {
  if (!isStandalone()) return;
  try {
    if (localStorage.getItem(REPORTED)) return;
  } catch {
    // storage blocked: the server keeps it once per account anyway
  }
  const { error } = await getSupabase().rpc("report_home_screen");
  if (error) return;
  try {
    localStorage.setItem(REPORTED, "1");
  } catch {
    // ignore
  }
}
