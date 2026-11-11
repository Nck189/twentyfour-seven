"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { FarmSky } from "@/components/art/farm/FarmSky";
import { MutationIcon } from "@/components/art/farm/Fx";
import { PlotArt } from "@/components/art/farm/PlotArt";
import { CropArt } from "@/components/art/farm/CropArt";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { BLOCK_KEYS, type BlockKey } from "@/content/blocks";
import type { CropId } from "@/content/crops";
import type { DecorId } from "@/content/decor";
import type { Quality } from "@/content/game";
import { useFarm, type FarmData } from "@/lib/farm/useFarm";
import { useGacha } from "@/lib/farm/useGacha";
import { useAnimals } from "@/lib/animals/useAnimals";
import { AnimalPen } from "./AnimalPen";
import { SeasonBanner } from "./SeasonBanner";
import { CollectionBook, UnlockNotice } from "./CollectionBook";
import { useUnlocks } from "@/lib/unlocks/useUnlocks";
import { seasonOf } from "@/content/seasons";
import { CROP_IDS } from "@/content/crops";
import { Capsule, CapsuleMachine } from "@/components/art/farm/Capsule";
import { CapsuleSheet } from "./CapsuleSheet";
import { Tip } from "@/components/tips/Tip";
import { SeedDexSheet } from "./SeedDexSheet";
import { sfx } from "@/lib/sound/sfx";
import { HarvestPop } from "./HarvestPop";
import { DECOR_ART } from "./DecorShop";
import { Shop } from "./Shop";
import { parseItem, sellPrice } from "@/lib/game/market";
import { Farmhouse } from "@/components/art/farm/Farmhouse";
import { RewardJarHint } from "./RewardJarHint";
import { PlotSheet } from "./PlotSheet";

const LOCKED_FIELDS = 3;

/**
 * The farm (SPEC §8): 7 block plots under a sky that follows the current block. A weak block is
 * visible at a glance (weeds, wilt). Tap a plot to plant, see how it's doing, or harvest.
 * `compact` = the iPad/Mac side panel (read-only, no sheets).
 */
export function FarmScreen({ compact = false }: { compact?: boolean }) {
  const { data, status, plant, harvest, buyDecor, reload } = useFarm();
  const gacha = useGacha();
  const animals = useAnimals();
  const unlocks = useUnlocks();
  return (
    <FarmView
      unlocks={compact ? undefined : (unlocks ?? undefined)}
      gacha={compact ? undefined : gacha}
      animals={compact ? undefined : animals}
      compact={compact}
      data={data}
      status={status}
      plant={plant}
      harvest={harvest}
      buyDecor={buyDecor}
      reload={reload}
    />
  );
}

/** The farm UI for given data (no I/O): the app passes useFarm; /dev/farm passes a sample week. */
export function FarmView({
  compact = false,
  data,
  status,
  plant,
  harvest,
  buyDecor,
  reload,
  gacha,
  animals,
  unlocks,
}: {
  compact?: boolean;
  data: FarmData | null;
  status: "loading" | "ready" | "error";
  plant: (slot: BlockKey, crop: CropId, replace?: boolean) => Promise<boolean>;
  harvest: (slot: BlockKey) => Promise<string | null>;
  buyDecor: (item: DecorId) => Promise<boolean>;
  reload: () => void;
  /** Capsule machine + Seed-dex (absent in the compact side panel and the preview). */
  gacha?: ReturnType<typeof useGacha>;
  /** Egg incubator + animal pen (absent in the compact side panel and the preview). */
  animals?: ReturnType<typeof useAnimals>;
  /** The unlock ladder (absent in the compact side panel). */
  unlocks?: NonNullable<ReturnType<typeof useUnlocks>>;
}) {
  const t = useTranslations("farm");
  const tc = useTranslations("common");
  const crops = useTranslations("crops");
  const tg = useTranslations("gacha");
  const blocks = useTranslations("blocks");
  const decorNames = useTranslations("decor");
  const [open, setOpen] = useState<BlockKey | null>(null);
  const [pop, setPop] = useState<{ cropId: CropId; quality: Quality; value?: number } | null>(null);
  const [sheet, setSheet] = useState<"capsules" | "dex" | null>(null);
  const endPop = useCallback(() => setPop(null), []);

  const header = <ScreenHeader title={t("title")} level={compact ? 2 : 1} />;
  if (status === "error" && !data)
    return (
      <>
        {header}
        <div role="alert" className="mx-4 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6">
          <p className="mb-3 font-bold">{t("loadError")}</p>
          <Button variant="secondary" onClick={reload}>
            {tc("retry")}
          </Button>
        </div>
      </>
    );
  if (!data)
    return (
      <>
        {header}
        <p role="status" className="mx-4 text-muted lg:mx-6">
          {tc("loading")}
        </p>
      </>
    );

  const { farm, sky } = data;
  const night = sky === "night";
  const label = (slot: BlockKey) => {
    const p = farm.plots[slot];
    const block = blocks(`name.${slot}`);
    if (!p) return t("plotEmpty", { block });
    const crop = crops(p.cropId);
    if (p.status === "dead") return t("plotDead", { block, crop });
    if (p.status === "ready") return t("plotReady", { block, crop });
    return t("plotGrowing", { block, crop, done: p.growthDays, total: p.growDays });
  };

  const art = (slot: BlockKey) => {
    const p = farm.plots[slot];
    return (
      <>
        <PlotArt
          cropId={p?.cropId}
          stage={p?.stage}
          status={p?.status}
          weeds={p?.weeds}
          wiltLevel={p?.wiltLevel}
          quality={p?.quality}
          mutations={p?.mutations}
          tile
          className="h-16 w-16 sm:h-20 sm:w-20"
        />
        <span
          aria-hidden="true"
          className="line-clamp-2 max-w-full rounded-lg bg-surface/90 px-1.5 text-center text-xs leading-tight font-bold break-words text-ink"
        >
          {blocks(`name.${slot}`)}
        </span>
      </>
    );
  };

  return (
    <>
      {header}
      {!compact && <SeasonBanner today={data.today} />}
      <section
        aria-label={t("title")}
        className="relative mx-4 overflow-hidden rounded-[var(--radius-lg)] lg:mx-6"
        data-sky={sky}
      >
        <FarmSky phase={sky} className="absolute inset-x-0 top-0 h-28 w-full" />
        {data.house > 0 && (
          // Its ground line (y 40 of 48) sits on the field's top edge (pt-16 = 64px).
          <div
            role="img"
            aria-label={t("house", { n: data.house })}
            className="absolute top-[11px] right-24 z-10"
          >
            <Farmhouse level={data.house} className="h-16 w-16" />
          </div>
        )}
        <div className="relative pt-16">
          {farm.giants.map((g) => (
            <div
              key={g.slots.join()}
              className="mx-3 mb-2 flex items-center gap-2 rounded-xl bg-surface/80 p-2"
            >
              <CropArt cropId={g.cropId} stage={3} status="ready" className="h-12 w-12" />
              <p className="font-extrabold">{t("giant", { crop: crops(g.cropId) })}</p>
            </div>
          ))}
          <ul
            className={`grid gap-1 rounded-t-[var(--radius-lg)] p-3 ${compact ? "grid-cols-4" : "grid-cols-4 sm:grid-cols-7"} ${
              night ? "bg-[var(--sky-night-bottom)]" : "bg-[var(--art-leaf-light)]"
            }`}
          >
            {BLOCK_KEYS.map((slot) => (
              <li key={slot}>
                {compact ? (
                  <div role="img" aria-label={label(slot)} className="flex flex-col items-center p-1">
                    {art(slot)}
                  </div>
                ) : (
                  <button
                    type="button"
                    aria-label={label(slot)}
                    onClick={() => setOpen(slot)}
                    className="tap flex w-full flex-col items-center rounded-xl p-1"
                  >
                    {art(slot)}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {data.decor.length > 0 && (
            <ul
              aria-label={t("decor")}
              className={`flex flex-wrap items-end gap-1 px-3 pb-3 ${night ? "bg-[var(--sky-night-bottom)]" : "bg-[var(--art-leaf-light)]"}`}
            >
              {data.decor.map((id, k) => {
                const Art = DECOR_ART[id];
                return (
                  <li key={`${id}-${k}`} aria-label={decorNames(id)}>
                    <Art className="h-10 w-10" />
                  </li>
                );
              })}
            </ul>
          )}
          {/* The farm's own night palette: one soft veil over the field (not the UI dark mode). */}
          {night && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[var(--sky-night-veil)] opacity-25"
            />
          )}
        </div>
      </section>

      {/* Full Farm screen only (not the side panel or the preview). */}
      <Tip id="plots" when={!!gacha} className="mt-3" />
      <section aria-label={t("weather")} className="mx-4 mt-3 lg:mx-6">
        <h2 className="mb-1 text-sm font-bold text-muted">{t("weather")}</h2>
        {farm.weather.length === 0 ? (
          <p className="text-sm text-muted">{t("weatherNone")}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {farm.weather.map((m) => (
              <li key={m} className="flex items-center gap-1 rounded-full bg-surface py-1 pr-3 pl-1 text-sm">
                <MutationIcon id={m} className="h-7 w-7" />
                <span className="font-bold">{t(`mutation.${m}`)}</span>
                <span className="text-muted">· {t(`mutationHint.${m}`)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {unlocks && <UnlockNotice granted={unlocks.granted} />}
      {/* Feature reveal (SPEC §8.8b): the capsule machine appears with the first ticket. */}
      {gacha?.state && (gacha.state.tickets > 0 || Object.keys(gacha.state.dex).length > 0) && (
        <section aria-label={tg("title")} className="mx-4 mt-4 grid grid-cols-2 gap-2 lg:mx-6">
          <button
            type="button"
            onClick={() => setSheet("capsules")}
            className="tap flex min-h-11 items-center gap-2 rounded-[var(--radius-lg)] bg-surface p-2 text-left"
          >
            <CapsuleMachine className="h-12 w-12 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate font-extrabold">{tg("title")}</span>
              <span className="block text-sm text-muted">{tg("tickets", { n: gacha.state.tickets })}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSheet("dex")}
            className="tap flex min-h-11 items-center gap-2 rounded-[var(--radius-lg)] bg-surface p-2 text-left"
          >
            <Capsule rarity="legendary" className="h-12 w-12 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate font-extrabold">{tg("dexTitle")}</span>
              <span className="block text-sm text-muted">
                {tg("dexShort", { have: Object.keys(gacha.state.dex).length, total: CROP_IDS.length })}
              </span>
            </span>
          </button>
        </section>
      )}
      <Tip
        id="capsule"
        when={!!gacha?.state && (gacha.state.tickets > 0 || Object.keys(gacha.state.dex).length > 0)}
        className="mt-3"
      />
      {sheet === "capsules" && gacha?.state && (
        <CapsuleSheet
          state={gacha.state}
          pull={gacha.pull}
          onClose={() => {
            setSheet(null);
            reload();
          }}
        />
      )}
      {sheet === "dex" && gacha?.state && (
        <SeedDexSheet state={gacha.state} starUp={gacha.starUp} onClose={() => setSheet(null)} />
      )}

      {unlocks && <CollectionBook state={unlocks} />}

      {animals && <AnimalPen animals={animals} />}

      {!compact && <RewardJarHint coins={data.coins} />}
      {!compact && <Shop onBuyDecor={buyDecor} season={seasonOf(data.today)} onChanged={reload} />}

      {/* Feature reveal: the farm expansion shows after the first harvest. */}
      {!compact && (gacha?.state?.harvested ?? true) && (
        <section aria-label={t("fields")} className="mx-4 mt-4 mb-6 lg:mx-6">
          <h2 className="mb-1 text-sm font-bold text-muted">{t("fields")}</h2>
          <div className="flex items-center gap-2">
            {Array.from({ length: LOCKED_FIELDS }, (_, i) => (
              <PlotArt key={i} locked className="h-14 w-14 opacity-70" />
            ))}
            <p className="text-sm text-muted">{t("fieldsLocked")}</p>
          </div>
        </section>
      )}

      {open && !compact && (
        <PlotSheet
          slot={open}
          plot={farm.plots[open]}
          onClose={() => setOpen(null)}
          seeds={gacha?.state?.seeds}
          onPlant={async (crop, replace) => {
            const ok = await plant(open, crop, replace);
            if (ok) {
              sfx.tick();
              setOpen(null);
              gacha?.reload();
            }
            return ok;
          }}
          onHarvest={async () => {
            const p = farm.plots[open];
            const item = await harvest(open);
            if (item && p) {
              sfx.harvest();
              setOpen(null);
              // The server's judgement of this harvest (same rules as the farm shows).
              const it = parseItem(item);
              setPop({
                cropId: p.cropId,
                quality: it?.kind === "crop" ? it.quality : p.quality,
                value: sellPrice(item, 0) ?? undefined,
              });
            }
            return item !== null;
          }}
        />
      )}
      {pop && <HarvestPop cropId={pop.cropId} quality={pop.quality} value={pop.value} onDone={endPop} />}
    </>
  );
}
