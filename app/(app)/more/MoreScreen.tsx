"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ExportCard } from "@/components/settings/ExportCard";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
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

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`tap min-h-11 flex-1 rounded-lg px-3 font-bold ${
            value === o.value ? "bg-surface text-primary" : "text-muted"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function MoreScreen() {
  const t = useTranslations("more");
  const router = useRouter();
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
    await getSupabase().auth.signOut();
    router.replace("/login");
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
