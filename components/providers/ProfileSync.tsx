"use client";

import { useEffect } from "react";
import { logEvent } from "@/lib/db/events";
import { isLocale } from "@/lib/i18n/config";
import { usePrefs } from "@/lib/store/prefs";
import { getSupabase, getUserCached } from "@/lib/supabase/client";
import { reportHomeScreenOnce } from "@/lib/setup/useSetupRewards";

/**
 * Language follows the account across devices (CJ-14). On the very first sign-in the device's
 * choice is saved to the profile; afterwards the profile wins, except for a change on this
 * device that hasn't been saved yet (e.g. the app reloaded mid-save).
 */
export function ProfileSync() {
  useEffect(() => {
    const client = getSupabase();
    let cancelled = false;
    (async () => {
      const { data } = await getUserCached();
      if (!data.user || cancelled) return;
      void reportHomeScreenOnce();
      const { data: profile } = await client
        .from("profiles")
        .select("locale, sound_on, onboarding")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (cancelled || !profile) return;
      const prefs = usePrefs.getState();
      const onboarding = (profile.onboarding ?? {}) as Record<string, unknown>;
      if (!onboarding.locale_set) {
        const first = prefs.locale;
        // A language picked on the login screen counts as the "choose your language" setup
        // step (playtest R1 P8): log it once the account exists.
        if (prefs.localeDirty) void logEvent("locale_changed", { locale: first, from: "login" });
        const { error } = await client
          .from("profiles")
          .update({ locale: first, onboarding: { ...onboarding, locale_set: true } })
          .eq("user_id", data.user.id)
          // Atomic: a late write must never overwrite a language the user already picked.
          .is("onboarding->locale_set", null);
        // A pick made while this was in flight stays unsaved (its own save is on the way).
        if (!error) usePrefs.getState().markLocaleSynced(first);
        return;
      }
      // An unsaved change made on this device wins (clock-free); otherwise the account's language
      // applies. Read the store now, not the snapshot from before the fetch.
      const now = usePrefs.getState();
      if (now.localeDirty) {
        const pick = now.locale;
        const { error } = await client.from("profiles").update({ locale: pick }).eq("user_id", data.user.id);
        if (!error) usePrefs.getState().markLocaleSynced(pick);
      } else if (isLocale(profile.locale)) {
        now.applyLocale(profile.locale);
      }
      if (typeof profile.sound_on === "boolean") now.setSoundOn(profile.sound_on);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
