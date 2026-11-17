"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AppMark } from "@/components/art/AppMark";
import { InAppNote } from "./InAppNote";
import { CropArt } from "@/components/art/farm/CropArt";
import { FarmSky } from "@/components/art/farm/FarmSky";
import { Farmhouse } from "@/components/art/farm/Farmhouse";
import { PlotArt } from "@/components/art/farm/PlotArt";
import { SomArt } from "@/components/art/Som";
import { Segmented } from "@/components/ui/Segmented";
import type { CropId } from "@/content/crops";
import { getSupabase } from "@/lib/supabase/client";
import type { Locale } from "@/lib/i18n/config";
import { usePrefs } from "@/lib/store/prefs";

const CROPS: readonly CropId[] = ["strawberry", "radish", "corn", "carrot"];
type Stage = 0 | 1 | 2 | 3;
const MOTION = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (cb: () => void) => {
  const m = window.matchMedia(MOTION);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const prefersReducedMotion = () => window.matchMedia(MOTION).matches;

/** The farm growing once: each plot a step behind its neighbour, then all ripe. Still when motion is reduced. */
function GrowingFarm({ label }: { label: string }) {
  const skipAnimations = usePrefs((p) => p.skipAnimations);
  // Read after hydration (the server can't know): the first paint matches the server's, so
  // there is no hydration error for people with reduced motion (G7 R-B-2).
  const reduce = useSyncExternalStore(subscribeMotion, prefersReducedMotion, () => false) || skipAnimations;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (reduce || tick >= 6) return;
    const id = setTimeout(() => setTick((n) => n + 1), 650);
    return () => clearTimeout(id);
  }, [reduce, tick]);
  const stage = (i: number): Stage => (reduce ? 3 : (Math.max(0, Math.min(3, tick - i)) as Stage));
  return (
    <div role="img" aria-label={label} className="relative overflow-hidden rounded-[var(--radius-lg)]">
      <FarmSky phase="sunrise" className="h-44" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-16 bg-[var(--art-leaf-2)]" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-3 flex items-end justify-between px-3">
        <SomArt className="h-16 w-16 shrink-0" />
        <div className="flex items-end">
          {CROPS.map((c, i) => (
            <PlotArt
              key={c}
              cropId={c}
              stage={stage(i)}
              status={stage(i) === 3 ? "ready" : "growing"}
              className="h-12 w-12 shrink-0"
            />
          ))}
        </div>
        <Farmhouse level={1} className="h-16 w-16 shrink-0" />
      </div>
    </div>
  );
}

/**
 * The front door (review fix B1): what 24/7 is, in one screen, and one way in. Signed-in people
 * never see it (the proxy sends them to Today), and the installed app starts at Today.
 */
export function Landing() {
  const t = useTranslations("landing");
  const tl = useTranslations("login");
  const { locale, setLocale } = usePrefs();
  // Back after signing in can restore this page from the browser's cache, past the proxy:
  // someone with a session goes on to Today (G7 R-B-1).
  useEffect(() => {
    const go = () =>
      void getSupabase()
        .auth.getSession()
        .then(({ data }) => {
          if (data.session) window.location.replace("/today");
        })
        .catch(() => {});
    go();
    window.addEventListener("pageshow", go);
    return () => window.removeEventListener("pageshow", go);
  }, []);
  const steps = [
    { key: "plan", art: <SomArt pose="sleep" className="h-14 w-14" /> },
    { key: "tap", art: <PlotArt cropId="radish" stage={1} className="h-14 w-14" /> },
    { key: "grow", art: <CropArt cropId="strawberry" stage={3} status="ready" className="h-14 w-14" /> },
  ] as const;
  return (
    <main className="safe-top safe-bottom mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 py-4">
      <header className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xl font-extrabold">
          <AppMark className="h-10 w-10" />
          24/7
        </span>
        <div className="w-40">
          <Segmented<Locale>
            compact
            label={tl("language")}
            value={locale}
            onChange={setLocale}
            options={[
              { value: "en", label: "EN" },
              { value: "th", label: "ไทย" },
            ]}
          />
        </div>
      </header>

      <GrowingFarm label={t("farmAlt")} />

      <div>
        <h1 className="text-3xl leading-tight font-extrabold">
          {/* Two lines on purpose: the break falls between the two ideas in both languages. */}
          <span className="block">{t("title")}</span>
          <span className="block text-primary">{t("title2")}</span>
        </h1>
        <p className="mt-2 text-lg text-muted">{t("subtitle")}</p>
      </div>

      <InAppNote />

      <div className="flex flex-col gap-2">
        <Link
          href="/login"
          className="tap flex min-h-12 items-center justify-center rounded-xl bg-primary px-4 text-lg font-bold text-on-primary"
        >
          {t("start")}
        </Link>
        <Link
          href="/login"
          className="tap flex min-h-11 items-center justify-center rounded-xl px-4 font-bold text-primary"
        >
          {t("haveAccount")}
        </Link>
      </div>

      <ul className="flex flex-col gap-2">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-surface p-3">
            <span aria-hidden="true" className="shrink-0">
              {s.art}
            </span>
            <span>
              <span className="block font-bold">{t(`steps.${s.key}.title`)}</span>
              <span className="block text-sm text-muted">{t(`steps.${s.key}.body`)}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="pb-2 text-center text-sm text-muted">{t("privacy")}</p>
    </main>
  );
}
