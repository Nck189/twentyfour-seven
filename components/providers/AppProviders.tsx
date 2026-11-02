"use client";

import { NextIntlClientProvider } from "next-intl";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { messages } from "@/lib/i18n/config";
import { usePrefs } from "@/lib/store/prefs";

const TIME_ZONE = "Asia/Bangkok";

function subscribeHydration(cb: () => void) {
  return usePrefs.persist.onFinishHydration(cb);
}

export function AppProviders({ children }: { children: ReactNode }) {
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    () => usePrefs.persist.hasHydrated(),
    () => false,
  );
  const storedLocale = usePrefs((s) => s.locale);
  const theme = usePrefs((s) => s.theme);
  const locale = hydrated ? storedLocale : "en";

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <NextIntlClientProvider locale={locale} messages={messages[locale]} timeZone={TIME_ZONE}>
      {children}
    </NextIntlClientProvider>
  );
}
