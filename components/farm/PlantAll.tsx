"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { CropArt } from "@/components/art/farm/CropArt";
import { DAY_ORDER, type BlockKey } from "@/content/blocks";
import { STARTER_CROPS, type CropId } from "@/content/crops";
import { getSupabase } from "@/lib/supabase/client";
import { sfx } from "@/lib/sound/sfx";

/**
 * Night ritual step 3 (SPEC §4.1 "Plant seeds in the 7 plots"): one tap on a seed picture plants
 * it in every empty block plot (server RPC per plot). Quiet when all 7 are growing.
 */
export function PlantAll() {
  const t = useTranslations("night");
  const crops = useTranslations("crops");
  const client = getSupabase();
  const [empty, setEmpty] = useState<BlockKey[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [planted, setPlanted] = useState(0);

  const fetchEmpty = useCallback(async (): Promise<BlockKey[] | null> => {
    const { data, error: err } = await client.from("plots").select("slot, crop_id");
    if (err) return null;
    const taken = new Set((data ?? []).filter((p) => p.crop_id).map((p) => p.slot as string));
    return DAY_ORDER.filter((b) => !taken.has(b));
  }, [client]);

  useEffect(() => {
    let cancelled = false;
    void fetchEmpty().then((e) => {
      if (!cancelled && e) setEmpty(e);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchEmpty]);

  if (empty === null) return null;
  const plantAll = async (crop: CropId) => {
    setBusy(true);
    setError(false);
    const results = await Promise.all(
      empty.map((slot) => client.rpc("plant_seed", { p_slot: slot, p_crop: crop })),
    );
    const ok = results.filter((r) => !r.error).length;
    setBusy(false);
    if (ok < empty.length) setError(true);
    if (ok > 0) {
      sfx.tick();
      setPlanted(ok);
    }
    const next = await fetchEmpty();
    if (next) setEmpty(next);
  };

  return (
    <section aria-label={t("seedsTitle")} className="rounded-xl bg-surface-2 p-3">
      <h4 className="font-bold">{t("seedsTitle")}</h4>
      {empty.length === 0 ? (
        <p role="status" className="text-sm text-muted">
          {planted > 0 ? t("seedsPlanted", { n: planted }) : t("seedsAllGrowing")}
        </p>
      ) : (
        <>
          <p className="mb-2 text-sm text-muted">{t("seedsHint", { n: empty.length })}</p>
          <ul className="grid grid-cols-4 gap-2">
            {STARTER_CROPS.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void plantAll(id)}
                  aria-label={t("seedsPlant", { crop: crops(id), n: empty.length })}
                  className="tap flex min-h-11 w-full flex-col items-center rounded-xl bg-surface p-1 disabled:opacity-50"
                >
                  <CropArt cropId={id} stage={3} status="ready" className="h-11 w-11" />
                  <span className="text-xs font-bold" aria-hidden="true">
                    {crops(id)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-bold text-accent">
          {t("seedsError")}
        </p>
      )}
    </section>
  );
}
