"use client";

import { useTranslations } from "next-intl";
import type { JSX } from "react";
import { BriefcaseIcon, CapIcon, LaptopIcon, SlidersIcon } from "@/components/ui/Icons";
import { STARTERS, type Starter } from "@/content/starters";

const ICON: Record<Starter["key"] | "custom", (p: { className?: string }) => JSX.Element> = {
  student: CapIcon,
  office: BriefcaseIcon,
  flex: LaptopIcon,
  custom: SlidersIcon,
};

/** One question, four big cards: a starter fills the week; "my own" keeps what's there. */
export function StarterStep({ onPick }: { onPick: (s: Starter | null) => void }) {
  const t = useTranslations("onboarding");
  const cards = [
    ...STARTERS.map((s) => ({ key: s.key, starter: s as Starter | null })),
    { key: "custom" as const, starter: null },
  ];
  return (
    <section aria-labelledby="ob-starter" className="flex flex-col gap-3">
      <h2 id="ob-starter" className="text-xl font-extrabold">
        {t("starterTitle")}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {cards.map(({ key, starter }) => {
          const Icon = ICON[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPick(starter)}
              className="tap flex min-h-32 flex-col items-start gap-2 rounded-[var(--radius-lg)] bg-surface p-3 text-left"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Icon className="h-6 w-6" />
              </span>
              <span className="font-extrabold">{t(`starter.${key}.title`)}</span>
              <span className="text-xs text-muted">{t(`starter.${key}.hint`)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
