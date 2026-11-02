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
        .select("locale, sound_on, onboarding, updated_at")
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
        return;
      }
      // The newer choice wins: a change made on this device after the profile's last write
      // (or while we were loading) is kept; otherwise the account's language is applied.
      const profileTime = Date.parse(profile.updated_at as string) || 0;
      const localIsNewer = prefs.localeChangedAt > profileTime || prefs.locale !== startLocale;
      if (!localIsNewer && isLocale(profile.locale)) prefs.applyLocale(profile.locale);
      if (localIsNewer && profile.locale !== prefs.locale) {
        await client.from("profiles").update({ locale: prefs.locale }).eq("user_id", data.user.id);
      }
      if (typeof profile.sound_on === "boolean") prefs.setSoundOn(profile.sound_on);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
