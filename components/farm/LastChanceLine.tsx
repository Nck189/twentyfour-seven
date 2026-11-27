"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { BLOCK_KEYS } from "@/content/blocks";
import { ChevronIcon } from "@/components/ui/Icons";
import type { FarmData } from "@/lib/farm/useFarm";
import { oneMissFromDeath, oneMissFromWeeds } from "@/lib/game";

/**
 * Today: one quiet line when the farm's health is at stake (rule A, Minnie OK 2026-11-27). The farm
 * is hurt by missed days, so every growing plot shares the same run: one line, not one per plot.
 * - one missed day before death (playtest R1 R2: plants died "with no warning")
 * - yesterday was the first missed day: one more brings weeds ("never miss twice")
 * Hidden once today already has an anchor (an in-window "I'm up" or the Night ritual), since that
 * ends the run, and when every plot is fine. Links to the farm.
 */
export function LastChanceLine({ data, keptToday }: { data: FarmData | null; keptToday: boolean }) {
  const t = useTranslations("farm");
  if (!data || keptToday) return null;
  const plots = BLOCK_KEYS.flatMap((b) => (data.farm.plots[b] ? [data.farm.plots[b]!] : []));
  const dying = plots.filter(oneMissFromDeath).length;
  const weedsNext = plots.some(oneMissFromWeeds);
  if (dying === 0 && !weedsNext) return null;
  return (
    <div className="mx-4 mb-3 lg:mx-6">
      <Link
        href="/farm"
        className="tap flex min-h-11 items-center gap-2 rounded-xl bg-warn-soft px-3 py-2 text-sm font-bold"
      >
        <span className="min-w-0 flex-1">
          {dying > 0 ? t("lastChanceToday", { n: dying }) : t("weedsTomorrow")}
        </span>
        <ChevronIcon className="h-4 w-4 -rotate-90" />
      </Link>
    </div>
  );
}
