"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { CropArt } from "@/components/art/farm/CropArt";
import { MutationIcon } from "@/components/art/farm/Fx";
import { PlotArt } from "@/components/art/farm/PlotArt";
import { Sheet } from "@/components/today/BlockSheet";
import { Button } from "@/components/ui/Button";
import type { BlockKey } from "@/content/blocks";
import { STARTER_CROPS, type CropId } from "@/content/crops";
import type { PlotView } from "@/lib/game";

/** Seed picker: starter seeds as pictures (rarer ones arrive with the gacha in M7). */
function SeedPicker({ onPick, busy }: { onPick: (crop: CropId) => void; busy: boolean }) {
  const t = useTranslations("farm");
  const crops = useTranslations("crops");
  return (
    <div>
      <p className="mb-2 text-sm font-bold text-muted">{t("starterSeeds")}</p>
      <ul className="grid grid-cols-4 gap-2">
        {STARTER_CROPS.map((id) => (
          <li key={id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onPick(id)}
              className="tap flex min-h-11 w-full flex-col items-center rounded-xl bg-surface-2 p-1 disabled:opacity-50"
            >
              <CropArt cropId={id} stage={3} status="ready" className="h-14 w-14" />
              <span className="text-xs font-bold">{crops(id)}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-muted">{t("moreSeeds")}</p>
    </div>
  );
}

/** One plot up close: what's growing, how it's doing, and the one action that fits. */
export function PlotSheet({
  slot,
  plot,
  onPlant,
  onHarvest,
  onClose,
}: {
  slot: BlockKey;
  plot: PlotView | undefined;
  onPlant: (crop: CropId, replace: boolean) => Promise<boolean>;
  onHarvest: () => Promise<boolean>;
  onClose: () => void;
}) {
  const t = useTranslations("farm");
  const crops = useTranslations("crops");
  const block = useTranslations("blocks")(`name.${slot}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [replacing, setReplacing] = useState(false);

  const act = async (fn: () => Promise<boolean>) => {
    setBusy(true);
    setError(false);
    const ok = await fn();
    setBusy(false);
    if (!ok) setError(true);
  };

  const errorLine = error && (
    <p role="alert" className="mt-3 rounded-xl bg-accent-soft p-3 text-sm font-bold">
      {t("actionError")}
    </p>
  );

  if (!plot) {
    return (
      <Sheet title={t("plantTitle", { block })} onClose={onClose}>
        <p className="mb-3 text-muted">{t("plantHint", { block })}</p>
        <SeedPicker busy={busy} onPick={(c) => void act(() => onPlant(c, false))} />
        {errorLine}
      </Sheet>
    );
  }

  const name = crops(plot.cropId);
  const stage = plot.status === "dead" ? "dead" : plot.status === "ready" ? "ready" : "growing";
  return (
    <Sheet title={block} onClose={onClose}>
      <div className="flex items-center gap-4">
        <PlotArt
          cropId={plot.cropId}
          stage={plot.stage}
          status={plot.status}
          weeds={plot.weeds}
          wiltLevel={plot.wiltLevel}
          quality={plot.quality}
          mutations={plot.mutations}
          className="h-32 w-32 shrink-0"
        />
        <div className="min-w-0">
          <p className="text-xl font-extrabold">{name}</p>
          {stage === "growing" && (
            <>
              <p className="text-muted">{t("progress", { done: plot.growthDays, total: plot.growDays })}</p>
              <div className="mt-1 flex gap-1" aria-hidden="true">
                {Array.from({ length: plot.growDays }, (_, i) => (
                  <span
                    key={i}
                    className={`h-2.5 w-5 rounded-full ${i < plot.growthDays ? "bg-primary" : "bg-surface-2"}`}
                  />
                ))}
              </div>
            </>
          )}
          {stage === "ready" && <p className="font-bold text-primary">{t("ready")}</p>}
          {stage !== "dead" && plot.record.days > 0 && (
            <p className="text-sm text-muted">
              {t("quality")}: {t(`qualityName.${plot.quality}`)}
            </p>
          )}
        </div>
      </div>

      {stage === "dead" && <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">{t("dead")}</p>}
      {stage === "growing" && plot.weeds && (
        <p className="mt-3 rounded-xl bg-warn-soft p-3 text-sm">{t("weeds")}</p>
      )}
      {stage !== "dead" && plot.wiltLevel > 0 && (
        <p className="mt-3 rounded-xl bg-warn-soft p-3 text-sm">{t("wilt")}</p>
      )}

      {plot.mutations.length > 0 && stage !== "dead" && (
        <div className="mt-3">
          <p className="mb-1 text-sm font-bold text-muted">
            {t("weatherOnCrop")} · {t("multiplier", { n: plot.multiplier })}
          </p>
          <ul className="flex flex-wrap gap-2">
            {plot.mutations.map((m) => (
              <li
                key={m}
                className="flex items-center gap-1 rounded-full bg-surface-2 py-1 pr-3 pl-1 text-sm"
              >
                <MutationIcon id={m} className="h-6 w-6" />
                <span className="font-bold">{t(`mutation.${m}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        {stage === "ready" && (
          <Button className="w-full" disabled={busy} onClick={() => void act(onHarvest)}>
            {t("harvest")}
          </Button>
        )}
        {stage === "dead" && (
          <>
            <p className="mb-2 font-bold">{t("clear")}</p>
            <SeedPicker busy={busy} onPick={(c) => void act(() => onPlant(c, true))} />
          </>
        )}
        {stage === "growing" &&
          (replacing ? (
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="font-bold">{t("replaceTitle", { crop: name })}</p>
              <p className="mb-3 text-sm text-muted">{t("replaceBody")}</p>
              <SeedPicker busy={busy} onPick={(c) => void act(() => onPlant(c, true))} />
            </div>
          ) : (
            <Button variant="secondary" className="w-full" onClick={() => setReplacing(true)}>
              {t("replace")}
            </Button>
          ))}
      </div>
      {errorLine}
    </Sheet>
  );
}
