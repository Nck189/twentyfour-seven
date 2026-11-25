"use client";

import { InviteCard } from "@/components/invite/InviteCard";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExportCard } from "@/components/settings/ExportCard";
import { TipsCard } from "@/components/settings/TipsCard";
import { CafeCard } from "@/components/settings/CafeCard";
import { NotificationsCard } from "@/components/settings/NotificationsCard";
import { CalendarCard } from "@/components/settings/CalendarCard";
import { ShareCard } from "@/components/settings/ShareCard";
import { SoundCard } from "@/components/settings/SoundCard";
import { DeleteAccount } from "@/components/settings/DeleteAccount";
import { ExerciseSettings } from "@/components/settings/ExerciseSettings";
import {
  ChevronIcon,
  MoonIcon,
  PeopleIcon,
  SlidersIcon,
  SunriseIcon,
  UploadIcon,
} from "@/components/ui/Icons";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Segmented } from "@/components/ui/Segmented";
import type { Locale } from "@/lib/i18n/config";
import { usePrefs, type ThemePref } from "@/lib/store/prefs";
import { getSupabase, getUserCached } from "@/lib/supabase/client";
import { logEvent } from "@/lib/db/events";
import { SetupCard, SetupRewardNotice } from "@/components/setup/SetupCard";
import { isStandalone, useSetupRewards } from "@/lib/setup/useSetupRewards";
import { MORE_GROUPS, hashRedirect, type MoreGroup } from "@/lib/more/groups";

const noop = () => () => {};

function Card({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  const h = useId();
  return (
    <section
      id={id}
      aria-labelledby={h}
      className="mx-4 mb-3 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6"
    >
      <h2 id={h} className="mb-3 text-lg font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

const GROUP_ICON: Record<MoreGroup, ReactNode> = {
  setup: <SunriseIcon className="h-5 w-5" />,
  sharing: <PeopleIcon className="h-5 w-5" />,
  preferences: <SlidersIcon className="h-5 w-5" />,
  account: <UploadIcon className="h-5 w-5" />,
};

/**
 * `/more` (review fix D): the setup progress and four rows, instead of one scroll of 15 cards.
 * Each row opens `/more/<group>` with the same cards, unchanged inside.
 */
export function MoreScreen() {
  const t = useTranslations("more");
  const router = useRouter();
  const setup = useSetupRewards();

  // Old links (`/more#language`, a bookmark, a notification) land on the card's page.
  useEffect(() => {
    const to = hashRedirect(window.location.hash);
    if (to) router.replace(to);
  }, [router]);

  return (
    <>
      <ScreenHeader title={t("title")} />
      {setup.state && <SetupRewardNotice granted={setup.state.granted} />}
      {setup.state && <SetupCard state={setup.state} />}
      <nav aria-label={t("title")} className="mx-4 mb-3 lg:mx-6">
        <ul className="flex flex-col gap-2">
          {MORE_GROUPS.map((g) => (
            <li key={g}>
              <Link
                href={`/more/${g}`}
                className="tap flex min-h-16 items-center gap-3 rounded-[var(--radius-lg)] bg-surface px-4 py-3"
              >
                <span className="text-primary">{GROUP_ICON[g]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{t(`groups.${g}.title`)}</span>
                  <span className="block text-sm text-muted">{t(`groups.${g}.hint`)}</span>
                </span>
                <ChevronIcon className="h-4 w-4 -rotate-90 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

/** One group's page: a way back to More, then its cards as they were. */
export function MoreGroupScreen({ group }: { group: MoreGroup }) {
  const t = useTranslations("more");
  // One claim per page, and every reward it pays is said here (G7 D-1). On Setup the exercise
  // reward shows next to its setting instead (Minnie 2026-11-14).
  const setup = useSetupRewards();
  const granted = setup.state?.granted ?? [];
  return (
    <>
      <div className="px-2 pt-2 lg:px-4">
        <Link
          href="/more"
          aria-label={t("backTo")}
          className="tap inline-flex min-h-11 items-center gap-1 rounded-xl px-2 font-bold text-primary"
        >
          <ChevronIcon className="h-4 w-4 rotate-90" />
          {t("back")}
        </Link>
      </div>
      <ScreenHeader title={t(`groups.${group}.title`)} />
      <SetupRewardNotice granted={group === "setup" ? granted.filter((g) => g !== "exercise") : granted} />
      {group === "setup" && <SetupGroup setup={setup} />}
      {group === "sharing" && (
        <>
          <InviteCard />
          <ShareCard />
          <CalendarCard />
        </>
      )}
      {group === "preferences" && <PreferencesGroup setup={setup} />}
      {group === "account" && <AccountGroup />}
    </>
  );
}

type Setup = ReturnType<typeof useSetupRewards>;

function SetupGroup({ setup }: { setup: Setup }) {
  const t = useTranslations("more");
  const te = useTranslations("exercise");
  return (
    <>
      <Card title={t("setupTitle")} id="setup-links">
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
        {/* The exercise reward shows next to its setting (Minnie 2026-11-14). */}
        {setup.state?.granted.includes("exercise") && (
          <div className="-mx-4 mt-3 lg:-mx-6">
            <SetupRewardNotice granted={["exercise"]} />
          </div>
        )}
      </Card>
    </>
  );
}

function PreferencesGroup({ setup }: { setup: Setup }) {
  const t = useTranslations("more");
  const { locale, setLocale, theme, setTheme } = usePrefs();

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

  return (
    <>
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
      <Card title={t("theme")} id="theme">
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
      <SoundCard />
      <NotificationsCard />
      <TipsCard />
      <CafeCard />
    </>
  );
}

function AccountGroup() {
  const t = useTranslations("more");
  const [email, setEmail] = useState<string | null>(null);
  // Display mode doesn't change while the app is open; the server render says "not installed".
  const installed = useSyncExternalStore(noop, isStandalone, () => false);

  useEffect(() => {
    void getUserCached().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function signOut() {
    await getSupabase().auth.signOut({ scope: "local" });
    // Hard navigation so the proxy sees the cleared cookies (no stale client router cache).
    window.location.replace(new URL("/login", window.location.origin).href);
  }

  return (
    <>
      <Card title={t("install")} id="install">
        <p className="text-muted">{installed ? t("installDone") : t("installSteps")}</p>
      </Card>
      {/* G15: the privacy promise in plain words, next to the export it points to. */}
      <Card title={t("privacy.title")} id="privacy">
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
          <li>{t("privacy.private")}</li>
          <li>{t("privacy.noAds")}</li>
          <li>{t("privacy.export")}</li>
          <li>{t("privacy.share")}</li>
          <li>{t("privacy.delete")}</li>
        </ul>
      </Card>
      <ExportCard />
      <Card title={t("account")} id="account">
        {email && <p className="mb-3 text-muted">{t("signedInAs", { email })}</p>}
        <Button variant="secondary" onClick={signOut}>
          {t("signOut")}
        </Button>
        <DeleteAccount />
      </Card>
    </>
  );
}
