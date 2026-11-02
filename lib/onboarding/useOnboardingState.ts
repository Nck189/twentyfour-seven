"use client";

import { useCallback, useEffect, useState } from "react";
import { logEvent } from "@/lib/db/events";
import { getSupabase } from "@/lib/supabase/client";
import { needsOnboarding, type OnboardingState } from "./index";

/** Whether to offer the first-run setup on Today, and "Later" (counts as skipped). */
export function useOnboardingState() {
  const client = getSupabase();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await client.auth.getUser();
      if (!data.user || cancelled) return;
      const { data: prof } = await client
        .from("profiles")
        .select("onboarding")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (cancelled) return;
      setUserId(data.user.id);
      setState((prof?.onboarding as OnboardingState) ?? {});
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  const later = useCallback(async () => {
    const next: OnboardingState = { ...state, skipped: true, at: new Date().toISOString() };
    setState(next);
    if (userId) await client.from("profiles").update({ onboarding: next }).eq("user_id", userId);
    void logEvent("onboarding_skipped", { from: "today" });
  }, [client, state, userId]);

  return { show: state !== null && needsOnboarding(state), later };
}
