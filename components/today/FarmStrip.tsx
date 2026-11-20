"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { FarmSky } from "@/components/art/farm/FarmSky";
import { PlotArt } from "@/components/art/farm/PlotArt";
import { SomArt } from "@/components/art/Som";
import { DAY_ORDER } from "@/content/blocks";
import type { FarmData } from "@/lib/farm/useFarm";

/**
 * Today's farm strip on phones (review fix C3): the 7 block plots at their real stage, in day
 * order, with Som at one end, so a check-in visibly grows something. Tap → the farm. Hidden from
 * `lg` up, where the farm is already in the side panel. Reads the farm Today already loads.
 */
export function FarmStrip({ data }: { data: FarmData | null }) {
  const t = useTranslations("today.farmStrip");
  if (!data) return null;
  return (
    <Link
      href="/farm"
      aria-label={t("open")}
      className="tap relative mx-4 mb-3 block overflow-hidden rounded-[var(--radius-lg)] lg:hidden"
    >
      <FarmSky phase={data.sky} className="h-12" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-6 bg-[var(--art-leaf-2)]" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 flex items-end justify-between px-2">
        <SomArt className="h-11 w-11 shrink-0" />
        {DAY_ORDER.map((b) => {
          const p = data.farm.plots[b];
          return (
            <span key={b} data-plot={b}>
              <PlotArt
                cropId={p?.cropId ?? null}
                stage={p?.stage ?? 0}
                status={p?.status}
                weeds={p?.weeds}
                wiltLevel={p?.wiltLevel}
                className="h-10 w-10 shrink-0"
              />
            </span>
          );
        })}
      </div>
    </Link>
  );
}
