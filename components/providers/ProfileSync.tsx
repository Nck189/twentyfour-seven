"use client";

import { useEffect } from "react";
import { isLocale } from "@/lib/i18n/config";
import { usePrefs } from "@/lib/store/prefs";
import { getSupabase } from "@/lib/supabase/client";
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
      const { data } = await client.auth.getUser();
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
        await client
          .from("profiles")
          .update({ locale: prefs.locale, onboarding: { ...onboarding, locale_set: true } })
          .eq("user_id", data.user.id)
          // Atomic: a late write must never overwrite a language the user already picked.
          .is("onboarding->locale_set", null);
        prefs.markLocaleSynced();
        return;
      }
      // An unsaved change made on this device wins (clock-free); otherwise the account's language applies.
      if (prefs.localeDirty) {
        const { error } = await client
          .from("profiles")
          .update({ locale: prefs.locale })
          .eq("user_id", data.user.id);
        if (!error) prefs.markLocaleSynced();
      } else if (isLocale(profile.locale)) {
        prefs.applyLocale(profile.locale);
      }
      if (typeof profile.sound_on === "boolean") prefs.setSoundOn(profile.sound_on);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
