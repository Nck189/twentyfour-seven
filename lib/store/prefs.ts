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
  /** When the user last changed the language on this device (ms since epoch). */
  localeChangedAt: number;
  /** User action: changes the language and stamps the change time. */
  setLocale: (locale: Locale) => void;
  /** Sync from the server profile: no timestamp bump. */
  applyLocale: (locale: Locale) => void;
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
      localeChangedAt: 0,
      setLocale: (locale) => set({ locale, localeChangedAt: Date.now() }),
      applyLocale: (locale) => set({ locale }),
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
