"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimalArt, EggArt } from "@/components/art/farm/Animals";
import { RarityLight } from "@/components/art/farm/Capsule";
import { Button } from "@/components/ui/Button";
import { RARITIES } from "@/content/crops";
import type { LogResult } from "@/lib/animals/useAnimals";
import { sfx } from "@/lib/sound/sfx";
import { usePrefs } from "@/lib/store/prefs";

type Hatched = NonNullable<LogResult["hatched"]>;

/**
 * The hatch (SPEC §8.6): the egg wobbles, cracks, and the animal pops out on its rarity light,
 * with a chirp. Skip shows it at once; reduced motion / "skip animations" go straight to it.
 * Phases only move forward (a timer never pulls the result back).
 */
export function HatchReveal({ hatched, onDone }: { hatched: Hatched; onDone: () => void }) {
  const t = useTranslations("pen");
  const tg = useTranslations("gacha");
  const name = useTranslations("animals")(hatched.species);
  const reduce = useReducedMotion();
  const skipPref = usePrefs((s) => s.skipAnimations) || Boolean(reduce);
  const [phase, setPhase] = useState<"egg" | "shown">(skipPref ? "shown" : "egg");
  const shown = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const rank = RARITIES.indexOf(hatched.rarity);

  const show = useCallback(() => {
    if (shown.current) return;
    shown.current = true;
    if (timer.current) clearTimeout(timer.current);
    sfx.jingle(Math.max(0, rank));
    setPhase("shown");
  }, [rank]);

  useEffect(() => {
    if (skipPref) {
      show();
      return;
    }
    sfx.hatch();
    timer.current = setTimeout(show, 1300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [skipPref, show]);

  useEffect(() => {
    box.current?.querySelector<HTMLButtonElement>("button[data-hatch-action]")?.focus();
  }, [phase]);

  return (
    <div
      ref={box}
      role="dialog"
      aria-modal="true"
      aria-label={t("hatchTitle")}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-bg p-4"
    >
      <p role="status" className="sr-only">
        {phase === "shown" ? t("meet", { name }) : ""}
      </p>
      <AnimatePresence mode="wait">
        {phase === "egg" ? (
          <motion.div
            key="egg"
            animate={{ rotate: [0, -8, 8, -6, 6, -10, 10, 0] }}
            transition={{ duration: 1.2 }}
          >
            <EggArt progress={2} className="h-44 w-44" />
          </motion.div>
        ) : (
          <motion.div
            key="shown"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: [0.7, 1.08, 1] }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center"
          >
            <p className="text-lg font-extrabold text-primary">{t("hatchTitle")}</p>
            <div className="relative h-48 w-48">
              <RarityLight rarity={hatched.rarity} className="absolute inset-0 h-full w-full" />
              <AnimalArt species={hatched.species} className="absolute inset-0 h-full w-full" />
            </div>
            <p className="text-xl font-extrabold">{t("meet", { name })}</p>
            <p className="text-sm text-muted">{tg(`rarity.${hatched.rarity}`)}</p>
          </motion.div>
        )}
      </AnimatePresence>
      {phase === "shown" ? (
        <Button data-hatch-action onClick={onDone} className="min-w-40">
          {t("done")}
        </Button>
      ) : (
        <Button data-hatch-action variant="secondary" onClick={show}>
          {t("skip")}
        </Button>
      )}
    </div>
  );
}
