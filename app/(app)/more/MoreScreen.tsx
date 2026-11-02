"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { ExportCard } from "@/components/settings/ExportCard";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Segmented } from "@/components/ui/Segmented";
import type { Locale } from "@/lib/i18n/config";
import { usePrefs, type ThemePref } from "@/lib/store/prefs";
import { getSupabase } from "@/lib/supabase/client";
import { logEvent } from "@/lib/db/events";

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mx-4 mb-3 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6">
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function MoreScreen() {
  const t = useTranslations("more");
  const { locale, setLocale, theme, setTheme } = usePrefs();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    getSupabase()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function changeLocale(next: Locale) {
    setLocale(next);
    const { data } = await getSupabase().auth.getUser();
    if (data.user) {
      // Synced across devices (CJ-14).
      const { data: prof } = await getSupabase()
        .from("profiles")
        .select("onboarding")
        .eq("user_id", data.user.id)
        .maybeSingle();
      const onboarding = { ...((prof?.onboarding ?? {}) as Record<string, unknown>), locale_set: true };
      await getSupabase().from("profiles").update({ locale: next, onboarding }).eq("user_id", data.user.id);
      await logEvent("locale_changed", { locale: next });
    }
  }

  async function signOut() {
    await getSupabase().auth.signOut({ scope: "local" });
    // Hard navigation so the proxy sees the cleared cookies (no stale client router cache).
    window.location.replace(new URL("/login", window.location.origin).href);
  }

  return (
    <>
      <ScreenHeader title={t("title")} />
      <Card title={t("language")}>
        <Segmented<Locale>
          label={t("language")}
          value={locale}
          onChange={changeLocale}
          options={[
            { value: "en", label: t("languageEn") },
            { value: "th", label: t("languageTh") },
          ]}
        />
      </Card>
      <Card title={t("theme")}>
        <Segmented<ThemePref>
          label={t("theme")}
          value={theme}
          onChange={setTheme}
          options={[
            { value: "system", label: t("themeSystem") },
            { value: "light", label: t("themeLight") },
            { value: "dark", label: t("themeDark") },
          ]}
        />
      </Card>
      <Card title={t("install")}>
        <p className="text-muted">{t("installSteps")}</p>
      </Card>
      <ExportCard />
      <Card title={t("account")}>
        {email && <p className="mb-3 text-muted">{t("signedInAs", { email })}</p>}
        <Button variant="secondary" onClick={signOut}>
          {t("signOut")}
        </Button>
      </Card>
    </>
  );
}
