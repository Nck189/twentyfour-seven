"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { SharePicture } from "@/components/share/SharePicture";
import { usedSince, weekShare } from "@/lib/stats/stats";
import type { StatsData } from "@/lib/stats/useStats";
import type { StreakView } from "@/lib/streak/useStreak";

/**
 * G4: "Share my week" as a picture for IG/LINE stories: her farm, the Day score ring, days logged,
 * perfect days, the streak and the best block. Nothing private (no tasks, names, times or notes).
 */
export function WeekShare({ data, streak }: { data: StatsData; streak: StreakView | null }) {
  const t = useTranslations("stats.share");
  const blocks = useTranslations("blocks");
  const tst = useTranslations("stats.score");
  const s = useMemo(() => weekShare(data.days, data.today, usedSince(data.days)), [data]);
  const days = streak?.streak ?? 0;
  const lines = useMemo(
    () => [
      { text: t("days", { n: s.days }) },
      { text: t("perfect", { n: s.perfectDays }) },
      ...(days > 0 ? [{ text: t("streak", { n: days }), icon: "streak" }] : []),
      ...(s.bestBlock ? [{ text: t("best", { block: blocks(`name.${s.bestBlock}`) }) }] : []),
    ],
    [s, days, t, blocks],
  );
  const ring = useMemo(() => ({ value: s.score, label: tst("title") }), [s.score, tst]);
  // Nothing logged this week: nothing worth sharing, so the card isn't offered (review fix A5).
  if (s.days === 0) return null;
  return (
    <section
      aria-label={t("cardTitle")}
      className="mx-4 mb-3 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6"
    >
      <h2 className="mb-1 text-lg font-bold">{t("cardTitle")}</h2>
      <p className="mb-3 text-sm text-muted">{t("hint")}</p>
      <SharePicture
        kind="week"
        title={t("title")}
        lines={lines}
        ring={ring}
        fileName="my-week.png"
        label={t("button")}
      />
    </section>
  );
}
