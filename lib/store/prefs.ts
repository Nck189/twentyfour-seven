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
  setLocale: (locale: Locale) => void;
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
      setLocale: (locale) => set({ locale }),
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
