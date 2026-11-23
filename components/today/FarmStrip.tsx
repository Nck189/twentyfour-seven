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
export function FarmStrip({ data, failed = false }: { data: FarmData | null; failed?: boolean }) {
  const t = useTranslations("today.farmStrip");
  // Its space is kept from the first paint, so nothing on Today moves under a finger when the
  // farm arrives (G7 R-C-2). No farm at all: no space.
  if (failed) return null;
  if (!data)
    return (
      <div aria-hidden="true" className="mx-4 mb-3 h-14 rounded-[var(--radius-lg)] bg-surface lg:hidden" />
    );
  return (
    <Link
      href="/farm"
      aria-label={t("open")}
      className="tap relative mx-4 mb-3 block h-14 overflow-hidden rounded-[var(--radius-lg)] lg:hidden"
    >
      <FarmSky phase={data.sky} className="h-14" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-6 bg-[var(--art-leaf-2)]" />
      {/* Eight equal columns (Som + 7 plots), each at most 48 px: fits the 56 px strip on wide
          screens (G7 N-3) and shrinks to fit a 320 px phone. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 grid grid-cols-[repeat(8,minmax(0,3rem))] items-end justify-between gap-0.5 px-1"
      >
        <SomArt className="aspect-square h-auto w-full" />
        {DAY_ORDER.map((b) => {
          const p = data.farm.plots[b];
          return (
            <span key={b} data-plot={b} className="block">
              <PlotArt
                cropId={p?.cropId ?? null}
                stage={p?.stage ?? 0}
                status={p?.status}
                weeds={p?.weeds}
                wiltLevel={p?.wiltLevel}
                className="aspect-square h-auto w-full"
              />
            </span>
          );
        })}
      </div>
    </Link>
  );
}
