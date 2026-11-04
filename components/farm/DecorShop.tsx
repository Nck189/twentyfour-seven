"use client";

import { useTranslations } from "next-intl";
import { useState, type ComponentType } from "react";
import { Coin } from "@/components/art/Coin";
import { Fence, Flowers, PathTile, Pond } from "@/components/art/farm/Plot";
import {
  Fireworks,
  GardenLantern,
  Jasmine,
  Krathong,
  Mailbox,
  RedLantern,
  StarTree,
  WaterBowl,
} from "@/components/art/farm/Festival";
import { BASIC_DECOR, DECOR_PRICE, type DecorId, type ShopDecorId } from "@/content/decor";
import type { Season } from "@/content/seasons";

export const DECOR_ART: Record<DecorId, ComponentType<{ className?: string }>> = {
  fence: Fence,
  path: PathTile,
  flowers: Flowers,
  pond: Pond,
  fireworks: Fireworks,
  red_lantern: RedLantern,
  water_bowl: WaterBowl,
  jasmine: Jasmine,
  krathong: Krathong,
  star_tree: StarTree,
  garden_lantern: GardenLantern,
  mailbox: Mailbox,
};

/** Decor shop basics (SPEC §8.9): pictures + price; the server takes the coins. */
export function DecorShop({
  coins,
  onBuy,
  season,
}: {
  coins: number;
  onBuy: (item: DecorId) => Promise<boolean>;
  /** This month's season: its festival item is in the shop only now (SPEC §8.8). */
  season?: Season;
}) {
  const t = useTranslations("farm");
  const names = useTranslations("decor");
  const [busy, setBusy] = useState<DecorId | null>(null);
  const [error, setError] = useState(false);
  return (
    <section aria-label={t("decor")} className="mx-4 mt-4 lg:mx-6">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-bold text-muted">{t("decor")}</h2>
        <p className="flex items-center gap-1 text-sm font-bold">
          <Coin className="h-5 w-5" />
          <span aria-hidden="true">{coins}</span>
          <span className="sr-only">{t("coins", { n: coins })}</span>
        </p>
      </div>
      <ul className="grid grid-cols-4 gap-2">
        {[...(season?.festival ? [season.festival] : []), ...BASIC_DECOR].map((id: ShopDecorId) => {
          const Art = DECOR_ART[id];
          const price = DECOR_PRICE[id];
          const short = coins < price;
          return (
            <li key={id}>
              <button
                type="button"
                disabled={short || busy !== null}
                aria-label={t("buyItem", { item: names(id), price })}
                onClick={async () => {
                  setBusy(id);
                  setError(false);
                  const ok = await onBuy(id);
                  setBusy(null);
                  if (!ok) setError(true);
                }}
                className="tap flex min-h-11 w-full flex-col items-center rounded-xl bg-surface p-1 disabled:opacity-50"
              >
                <Art className="h-12 w-12" />
                <span className="text-xs font-bold">{names(id)}</span>
                {id === season?.festival && (
                  <span className="rounded-full bg-primary-soft px-1.5 text-[11px] font-bold text-primary">
                    {t("onlyThisMonth")}
                  </span>
                )}
                <span className="flex items-center gap-0.5 text-xs" aria-hidden="true">
                  <Coin className="h-3.5 w-3.5" />
                  {price}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="mt-2 rounded-xl bg-accent-soft p-3 text-sm font-bold">
          {t("actionError")}
        </p>
      )}
    </section>
  );
}
