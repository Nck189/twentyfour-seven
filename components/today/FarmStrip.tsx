"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { FarmSky } from "@/components/art/farm/FarmSky";
import { PlotArt } from "@/components/art/farm/PlotArt";
import { SomArt } from "@/components/art/Som";
import { DAY_ORDER } from "@/content/blocks";
import type { FarmData } from "@/lib/farm/useFarm";
import { usePrefs } from "@/lib/store/prefs";
import { onBlockDone } from "@/lib/ui/rewardEvents";
import type { BlockKey } from "@/content/blocks";
import type { SkyPhase } from "@/lib/farm/sky";

/**
 * Today's farm strip on phones (review fix C3): the 7 block plots at their real stage, in day
 * order, with Som at one end, so a check-in visibly grows something. Tap → the farm. Hidden from
 * `lg` up, where the farm is already in the side panel. Reads the farm Today already loads.
 */
export function FarmStrip({
  data,
  failed = false,
  phase = "day",
}: {
  data: FarmData | null;
  failed?: boolean;
  /** The sky of the current block, for the empty field shown until the farm arrives. */
  phase?: SkyPhase;
}) {
  const t = useTranslations("today.farmStrip");
  // A block finished on Today: its plot bounces once and Som looks up (review fix F2).
  const [done, setDone] = useState<{ key: BlockKey; n: number } | null>(null);
  const skip = usePrefs((s) => s.skipAnimations);
  useEffect(() => onBlockDone((key) => setDone((d) => ({ key, n: (d?.n ?? 0) + 1 }))), []);
  const bounce = (on: boolean) => (on && !skip ? "grow-step" : "");
  // Its space is kept from the first paint, so nothing on Today moves under a finger when the
  // farm arrives (G7 R-C-2). No farm at all: no space.
  if (failed) return null;
  // While the farm is on its way (Today reads it 2 s later): an empty field, sky and grass, not a
  // blank card that reads as broken (visual baselines 2026-11-23).
  if (!data)
    return (
      <div
        aria-hidden="true"
        data-farm-strip="waiting"
        className="relative mx-4 mb-3 h-14 overflow-hidden rounded-[var(--radius-lg)] lg:hidden"
      >
        <FarmSky phase={phase} className="h-14" />
        <div className="absolute inset-x-0 bottom-0 h-6 bg-[var(--art-leaf-2)]" />
      </div>
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
        <span key={`som-${done?.n ?? 0}`} className={`block ${bounce(done !== null)}`}>
          <SomArt className="aspect-square h-auto w-full" />
        </span>
        {DAY_ORDER.map((b) => {
          const p = data.farm.plots[b];
          return (
            <span
              key={done?.key === b ? `${b}-${done.n}` : b}
              data-plot={b}
              className={`block ${bounce(done?.key === b)}`}
              style={done?.key === b ? { animationDelay: "120ms" } : undefined}
            >
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
