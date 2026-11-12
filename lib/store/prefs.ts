"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Locale } from "@/lib/i18n/config";

export type ThemePref = "system" | "light" | "dark";

type PrefsState = {
  locale: Locale;
  theme: ThemePref;
  soundOn: boolean;
  skipAnimations: boolean;
  /** Sounds go quiet by themselves during Focus and Work blocks (lib/sound/quiet.ts). */
  autoQuiet: boolean;
  /** True while a language change made on this device hasn't been saved to the profile yet. */
  localeDirty: boolean;
  /** User action: changes the language and marks it unsaved. */
  setLocale: (locale: Locale) => void;
  /** Sync from the server profile (not a user change). */
  applyLocale: (locale: Locale) => void;
  /**
   * The profile now holds `saved`. Only clears the unsaved mark when that's still the language
   * on this device: a save of an older pick must not swallow a newer one (CJ-14 race).
   */
  markLocaleSynced: (saved: Locale) => void;
  setTheme: (theme: ThemePref) => void;
  setSoundOn: (on: boolean) => void;
  setSkipAnimations: (skip: boolean) => void;
  setAutoQuiet: (on: boolean) => void;
};

/** The first visit's language: the device's first preference if it's Thai, else English (R1 P8). */
export function detectLocale(languages: readonly string[]): Locale {
  return languages[0]?.toLowerCase().startsWith("th") ? "th" : "en";
}
const deviceLocale = (): Locale =>
  typeof navigator === "undefined" ? "en" : detectLocale(navigator.languages ?? [navigator.language]);

/** Per-device UI preferences. Locale/sound are also synced to `profiles` after login. */
export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      // Stored prefs win after hydration; this only decides a first visit.
      locale: deviceLocale(),
      theme: "system",
      soundOn: true,
      skipAnimations: false,
      autoQuiet: true,
      localeDirty: false,
      setLocale: (locale) => set({ locale, localeDirty: true }),
      applyLocale: (locale) => set({ locale, localeDirty: false }),
      markLocaleSynced: (saved) => set((s) => (s.locale === saved ? { localeDirty: false } : {})),
      setTheme: (theme) => set({ theme }),
      setSoundOn: (soundOn) => set({ soundOn }),
      setSkipAnimations: (skipAnimations) => set({ skipAnimations }),
      setAutoQuiet: (autoQuiet) => set({ autoQuiet }),
    }),
    {
      name: "247-prefs",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
