"use client";

import { useTranslations } from "next-intl";
import { actualChoices } from "@/lib/stats/estimates";
import type { BacklogItem } from "@/lib/backlog";

/**
 * "How long did it take?" right after finishing a task that had an estimate (M14 estimate vs
 * actual). One tap on a time, or Skip; nothing depends on it but the Stats card.
 */
export function ActualPrompt({
  item,
  onPick,
  onSkip,
}: {
  item: BacklogItem & { estimate_min: number };
  onPick: (min: number) => void;
  onSkip: () => void;
}) {
  const t = useTranslations("backlog");
  return (
    <section
      aria-label={t("actual.title", { title: item.title })}
      className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 rounded-[var(--radius-lg)] bg-surface-2 p-3 lg:right-6 lg:bottom-6 lg:left-auto lg:w-96"
    >
      <p className="mb-2 text-sm font-bold">{t("actual.title", { title: item.title })}</p>
      <p className="mb-2 text-xs text-muted">{t("actual.planned", { n: item.estimate_min })}</p>
      <div className="flex flex-wrap gap-2">
        {actualChoices(item.estimate_min).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onPick(m)}
            className="tap min-h-11 min-w-11 rounded-xl bg-primary-soft px-3 font-bold text-primary"
          >
            {t("actual.min", { n: m })}
          </button>
        ))}
        <button type="button" onClick={onSkip} className="tap min-h-11 rounded-xl px-3 text-sm text-muted">
          {t("actual.skip")}
        </button>
      </div>
    </section>
  );
}
