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
import type { Quality } from "@/content/game";
import { useFarm, type FarmData } from "@/lib/farm/useFarm";
import { sfx } from "@/lib/sound/sfx";
import { HarvestPop } from "./HarvestPop";
import { PlotSheet } from "./PlotSheet";

const LOCKED_FIELDS = 3;

/**
 * The farm (SPEC §8): 7 block plots under a sky that follows the current block. A weak block is
 * visible at a glance (weeds, wilt). Tap a plot to plant, see how it's doing, or harvest.
 * `compact` = the iPad/Mac side panel (read-only, no sheets).
 */
export function FarmScreen({ compact = false }: { compact?: boolean }) {
  const { data, status, plant, harvest, reload } = useFarm();
  return (
    <FarmView compact={compact} data={data} status={status} plant={plant} harvest={harvest} reload={reload} />
  );
}

/** The farm UI for given data (no I/O): the app passes useFarm; /dev/farm passes a sample week. */
export function FarmView({
  compact = false,
  data,
  status,
  plant,
  harvest,
  reload,
}: {
  compact?: boolean;
  data: FarmData | null;
  status: "loading" | "ready" | "error";
  plant: (slot: BlockKey, crop: CropId, replace?: boolean) => Promise<boolean>;
  harvest: (slot: BlockKey) => Promise<boolean>;
  reload: () => void;
}) {
  const t = useTranslations("farm");
  const tc = useTranslations("common");
  const crops = useTranslations("crops");
  const blocks = useTranslations("blocks");
  const [open, setOpen] = useState<BlockKey | null>(null);
  const [pop, setPop] = useState<{ cropId: CropId; quality: Quality } | null>(null);
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
          className={`w-full truncate text-center text-xs font-bold ${night ? "text-[var(--sky-star)]" : "text-ink"}`}
        >
          {blocks(`name.${slot}`)}
        </span>
      </>
    );
  };

  return (
    <>
      {header}
      <section
        aria-label={t("title")}
        className="relative mx-4 overflow-hidden rounded-[var(--radius-lg)] lg:mx-6"
        data-sky={sky}
      >
        <FarmSky phase={sky} className="absolute inset-x-0 top-0 h-28 w-full" />
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
          {/* The farm's own night palette: one soft veil over the field (not the UI dark mode). */}
          {night && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[var(--sky-night-veil)] opacity-25"
            />
          )}
        </div>
      </section>

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

      {!compact && (
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
          onPlant={async (crop, replace) => {
            const ok = await plant(open, crop, replace);
            if (ok) {
              sfx.tick();
              setOpen(null);
            }
            return ok;
          }}
          onHarvest={async () => {
            const p = farm.plots[open];
            const ok = await harvest(open);
            if (ok && p) {
              sfx.harvest();
              setOpen(null);
              setPop({ cropId: p.cropId, quality: p.quality });
            }
            return ok;
          }}
        />
      )}
      {pop && <HarvestPop cropId={pop.cropId} quality={pop.quality} onDone={endPop} />}
    </>
  );
}
