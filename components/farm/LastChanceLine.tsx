"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { BLOCK_KEYS } from "@/content/blocks";
import { ChevronIcon } from "@/components/ui/Icons";
import { useBlockText } from "@/components/today/useBlockText";
import { useFarm } from "@/lib/farm/useFarm";
import { oneMissFromDeath } from "@/lib/game";

/**
 * Today: a plot one miss away from dying says so before it happens (playtest R1 R2: plants died
 * "with no warning"). Links to the farm; hidden when every plot is fine.
 */
export function LastChanceLine() {
  const t = useTranslations("farm");
  const crops = useTranslations("crops");
  const text = useBlockText();
  const { data } = useFarm();
  if (!data) return null;
  const atRisk = BLOCK_KEYS.flatMap((b) => {
    const p = data.farm.plots[b];
    return p && oneMissFromDeath(p) ? [p] : [];
  });
  if (atRisk.length === 0) return null;
  return (
    <div className="mx-4 mb-3 flex flex-col gap-2 lg:mx-6">
      {atRisk.map((p) => (
        <Link
          key={p.slot}
          href="/farm"
          className="tap flex min-h-11 items-center gap-2 rounded-xl bg-warn-soft px-3 text-sm font-bold"
        >
          <span className="min-w-0 flex-1">
            {t("lastChanceToday", { crop: crops(p.cropId), block: text.name(p.slot) })}
          </span>
          <ChevronIcon className="h-4 w-4 -rotate-90" />
        </Link>
      ))}
    </div>
  );
}
