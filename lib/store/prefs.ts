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
  /** True while a language change made on this device hasn't been saved to the profile yet. */
  localeDirty: boolean;
  /** User action: changes the language and marks it unsaved. */
  setLocale: (locale: Locale) => void;
  /** Sync from the server profile (not a user change). */
  applyLocale: (locale: Locale) => void;
  markLocaleSynced: () => void;
  setTheme: (theme: ThemePref) => void;
  setSoundOn: (on: boolean) => void;
  setSkipAnimations: (skip: boolean) => void;
};

/** Per-device UI preferences. Locale/sound are also synced to `profiles` after login. */
export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      locale: "en",
      theme: "system",
      soundOn: true,
      skipAnimations: false,
      localeDirty: false,
      setLocale: (locale) => set({ locale, localeDirty: true }),
      applyLocale: (locale) => set({ locale, localeDirty: false }),
      markLocaleSynced: () => set({ localeDirty: false }),
      setTheme: (theme) => set({ theme }),
      setSoundOn: (soundOn) => set({ soundOn }),
      setSkipAnimations: (skipAnimations) => set({ skipAnimations }),
    }),
    {
      name: "247-prefs",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
