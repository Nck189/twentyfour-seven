"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { CropArt } from "@/components/art/farm/CropArt";
import { Sheet } from "@/components/today/BlockSheet";
import { Button } from "@/components/ui/Button";
import { CROP_IDS, type CropId } from "@/content/crops";
import { STAR_UP_COST } from "@/content/gacha";
import type { GachaState } from "@/lib/farm/useGacha";

/**
 * Seed-dex (SPEC §8.5): every crop; ones you haven't found are soft silhouettes. Completion %
 * on top. Tap an owned crop to star it up with its shards (★1 → ★5).
 */
export function SeedDexSheet({
  state,
  starUp,
  onClose,
}: {
  state: GachaState;
  starUp: (crop: CropId) => Promise<boolean>;
  onClose: () => void;
}) {
  const t = useTranslations("gacha");
  const crops = useTranslations("crops");
  const [open, setOpen] = useState<CropId | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const have = CROP_IDS.filter((id) => state.dex[id]).length;
  const sel = open ? state.dex[open] : undefined;
  const cost = sel && sel.star < 5 ? STAR_UP_COST[sel.star as 1 | 2 | 3 | 4] : null;
  const shards = open ? (state.shards[open] ?? 0) : 0;

  return (
    <Sheet title={t("dexTitle")} onClose={onClose}>
      <p className="mb-3 font-bold">
        {t("dexProgress", { have, total: CROP_IDS.length, pct: Math.round((have / CROP_IDS.length) * 100) })}
      </p>
      <ul className="grid grid-cols-4 gap-2">
        {CROP_IDS.map((id) => {
          const d = state.dex[id];
          return (
            <li key={id}>
              {d ? (
                <button
                  type="button"
                  onClick={() => setOpen(id)}
                  aria-pressed={open === id}
                  className={`tap flex min-h-11 w-full flex-col items-center rounded-xl p-1 ${open === id ? "bg-primary-soft" : "bg-surface-2"}`}
                >
                  <CropArt cropId={id} stage={3} status="ready" className="h-12 w-12" />
                  <span className="w-full truncate text-center text-[11px] font-bold">{crops(id)}</span>
                  <span className="text-[11px] text-muted">{t("stars", { n: d.star })}</span>
                </button>
              ) : (
                <div
                  role="img"
                  aria-label={t("unknown")}
                  className="flex min-h-11 flex-col items-center rounded-xl bg-surface-2 p-1"
                >
                  {/* A soft silhouette (never black): the art flattened to a light tone. */}
                  <span className="opacity-40" style={{ filter: "brightness(0) invert(0.6)" }}>
                    <CropArt cropId={id} stage={3} status="ready" className="h-12 w-12" />
                  </span>
                  <span className="text-[11px] text-muted" aria-hidden="true">
                    ?
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {open && sel && (
        <div className="mt-4 rounded-xl bg-surface-2 p-3">
          <p className="font-extrabold">
            {crops(open)} · {t("stars", { n: sel.star })}
          </p>
          <p className="text-sm text-muted">{t("shardsHave", { n: shards })}</p>
          {cost !== null ? (
            <Button
              className="mt-2 w-full"
              disabled={busy || shards < cost}
              onClick={async () => {
                // One star-up per tap: a double-tap must not spend twice (R-M7-4).
                if (busyRef.current) return;
                busyRef.current = true;
                setBusy(true);
                setError(false);
                const ok = await starUp(open);
                busyRef.current = false;
                setBusy(false);
                if (!ok) setError(true);
              }}
            >
              {t("starUp", { n: cost })}
            </Button>
          ) : (
            <p className="mt-2 text-sm font-bold">{t("maxStar")}</p>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm font-bold text-accent">
              {t("error")}
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}
