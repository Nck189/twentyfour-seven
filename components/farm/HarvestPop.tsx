"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { CropArt } from "@/components/art/farm/CropArt";
import { QualityStar } from "@/components/art/farm/Fx";
import { Art } from "@/components/art/farm/parts";
import type { CropId } from "@/content/crops";
import type { Quality } from "@/content/game";
import { usePrefs } from "@/lib/store/prefs";

const DURATION_MS = 1600;
const BITS = [0, 45, 90, 135, 180, 225, 270, 315];

/**
 * The harvest moment (SPEC §8.2 "harvest feel matters most"): the crop pops out of the soil
 * (squash → stretch → settle), juicy bits burst, "+1 Carrot". ≤ 1.6 s, tap to skip; skipped
 * entirely with reduced motion or the "skip animations" setting.
 */
export function HarvestPop({
  cropId,
  quality,
  onDone,
}: {
  cropId: CropId;
  quality: Quality;
  onDone: () => void;
}) {
  const reduce = useReducedMotion();
  const skip = usePrefs((s) => s.skipAnimations) || Boolean(reduce);
  const t = useTranslations("farm");
  const tc = useTranslations("common");
  const crop = useTranslations("crops")(cropId);

  useEffect(() => {
    const id = setTimeout(onDone, skip ? 0 : DURATION_MS);
    return () => clearTimeout(id);
  }, [onDone, skip]);

  if (skip) return null;
  return (
    <AnimatePresence>
      <motion.button
        type="button"
        aria-label={tc("close")}
        onClick={onDone}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-2 bg-bg/70"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        <div className="relative h-44 w-44">
          {BITS.map((deg, i) => (
            <motion.span
              key={deg}
              aria-hidden="true"
              className={`absolute top-1/2 left-1/2 h-3 w-3 rounded-full ${i % 2 ? "bg-warn-soft" : "bg-primary-soft"}`}
              initial={{ x: -6, y: -6, scale: 0 }}
              animate={{
                x: Math.cos((deg * Math.PI) / 180) * 80 - 6,
                y: Math.sin((deg * Math.PI) / 180) * 80 - 6,
                scale: [0, 1.2, 0],
              }}
              transition={{ delay: 0.32, duration: 0.7, ease: "easeOut" }}
            />
          ))}
          <motion.div
            className="absolute inset-0"
            style={{ originY: 1 }}
            initial={{ y: 40, scaleX: 1, scaleY: 1, opacity: 0 }}
            animate={{
              y: [40, 40, -18, 0],
              scaleX: [1, 1.25, 0.88, 1],
              scaleY: [1, 0.75, 1.15, 1],
              opacity: [0, 1, 1, 1],
            }}
            transition={{ duration: 0.6, times: [0, 0.25, 0.65, 1], ease: "easeOut" }}
          >
            <CropArt cropId={cropId} stage={3} status="ready" className="h-44 w-44" />
          </motion.div>
          {quality !== "normal" && (
            <motion.div
              className="absolute -top-2 -right-2"
              initial={{ scale: 0, rotate: -40 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.5, type: "spring", stiffness: 400, damping: 14 }}
            >
              <Art className="h-14 w-14">
                <QualityStar quality={quality} cx={24} cy={24} r={18} />
              </Art>
            </motion.div>
          )}
        </div>
        <motion.p
          className="text-2xl font-extrabold"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.25 }}
        >
          {t("harvested", { crop })}
        </motion.p>
      </motion.button>
    </AnimatePresence>
  );
}
