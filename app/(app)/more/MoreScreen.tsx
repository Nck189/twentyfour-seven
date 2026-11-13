"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { ExportCard } from "@/components/settings/ExportCard";
import { TipsCard } from "@/components/settings/TipsCard";
import { CafeCard } from "@/components/settings/CafeCard";
import { NotificationsCard } from "@/components/settings/NotificationsCard";
import { CalendarCard } from "@/components/settings/CalendarCard";
import { SoundCard } from "@/components/settings/SoundCard";
import { ExerciseSettings } from "@/components/settings/ExerciseSettings";
import { ChevronIcon, MoonIcon, SunriseIcon } from "@/components/ui/Icons";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Segmented } from "@/components/ui/Segmented";
import type { Locale } from "@/lib/i18n/config";
import { usePrefs, type ThemePref } from "@/lib/store/prefs";
import { getSupabase, getUserCached } from "@/lib/supabase/client";
import { logEvent } from "@/lib/db/events";
import { SetupCard, SetupRewardNotice } from "@/components/setup/SetupCard";
import { isStandalone, useSetupRewards } from "@/lib/setup/useSetupRewards";

const noop = () => () => {};

function Card({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="mx-4 mb-3 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6">
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function MoreScreen() {
  const t = useTranslations("more");
  const te = useTranslations("exercise");
  const { locale, setLocale, theme, setTheme } = usePrefs();
  const [email, setEmail] = useState<string | null>(null);
  const setup = useSetupRewards();
  // Display mode doesn't change while the app is open; the server render says "not installed".
  const installed = useSyncExternalStore(noop, isStandalone, () => false);

  useEffect(() => {
    void getUserCached().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function changeLocale(next: Locale) {
    setLocale(next);
    const { data } = await getUserCached();
    if (data.user) {
      // Synced across devices (CJ-14).
      const { data: prof } = await getSupabase()
        .from("profiles")
        .select("onboarding")
        .eq("user_id", data.user.id)
        .maybeSingle();
      const onboarding = { ...((prof?.onboarding ?? {}) as Record<string, unknown>), locale_set: true };
      const { error } = await getSupabase()
        .from("profiles")
        .update({ locale: next, onboarding })
        .eq("user_id", data.user.id);
      if (!error) usePrefs.getState().markLocaleSynced(next);
      await logEvent("locale_changed", { locale: next });
      setup.reload();
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
      {setup.state && <SetupRewardNotice granted={setup.state.granted} />}
      {setup.state && <SetupCard state={setup.state} />}
      <Card title={t("setupTitle")}>
        <ul className="flex flex-col gap-2">
          {(
            [
              {
                href: "/welcome?step=week&from=more",
                label: t("setupSleep"),
                icon: <MoonIcon className="h-5 w-5" />,
              },
              {
                href: "/welcome?step=first10&from=more",
                label: t("setupFirst10"),
                icon: <SunriseIcon className="h-5 w-5" />,
              },
            ] as const
          ).map((row) => (
            <li key={row.href}>
              <Link
                href={row.href}
                className="tap flex min-h-12 items-center gap-3 rounded-xl bg-surface-2 px-3 font-bold"
              >
                <span className="text-primary">{row.icon}</span>
                <span className="flex-1">{row.label}</span>
                <ChevronIcon className="h-4 w-4 -rotate-90 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <Card title={te("settingsTitle")} id="exercise">
        <ExerciseSettings onSaved={setup.reload} />
      </Card>
      <Card title={t("language")} id="language">
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
      <NotificationsCard />
      <CalendarCard />
      <SoundCard />
      <TipsCard />
      <CafeCard />
      <Card title={t("install")} id="install">
        <p className="text-muted">{installed ? t("installDone") : t("installSteps")}</p>
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
