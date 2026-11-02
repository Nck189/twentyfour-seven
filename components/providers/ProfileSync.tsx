"use client";

import { useEffect } from "react";
import { isLocale } from "@/lib/i18n/config";
import { usePrefs } from "@/lib/store/prefs";
import { getSupabase } from "@/lib/supabase/client";

/**
 * Language follows the account across devices (CJ-14). On the very first sign-in the device's
 * choice is saved to the profile; afterwards the profile wins — unless the user changes the
 * language on this screen before the profile has loaded.
 */
export function ProfileSync() {
  useEffect(() => {
    const client = getSupabase();
    const startLocale = usePrefs.getState().locale;
    let cancelled = false;
    (async () => {
      const { data } = await client.auth.getUser();
      if (!data.user || cancelled) return;
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
          .eq("user_id", data.user.id);
        return;
      }
      // Don't clobber a change the user made while we were loading.
      if (prefs.locale === startLocale && isLocale(profile.locale)) prefs.setLocale(profile.locale);
      if (typeof profile.sound_on === "boolean") prefs.setSoundOn(profile.sound_on);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
