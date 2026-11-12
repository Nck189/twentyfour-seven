"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { SomArt } from "@/components/art/Som";
import { Sparkle } from "@/components/art/farm/parts";
import { Button } from "@/components/ui/Button";
import { STORY, type StoryBeatId, type StoryGift } from "@/content/story";
import { sfx } from "@/lib/sound/sfx";
import { usePrefs } from "@/lib/store/prefs";
import { StoryScene } from "./StoryScene";

/**
 * A short story beat with Som (docs/STORY.md): 3–5 panels, tap Next, Skip any time. With reduced
 * motion or "skip animations" every panel is still. The meow follows the global mute. The gift
 * (already granted by the server) shows on the last panel.
 */
export function Cutscene({
  beat,
  gift,
  onDone,
}: {
  beat: StoryBeatId;
  gift: StoryGift | null;
  onDone: () => void;
}) {
  const t = useTranslations("story");
  const tc = useTranslations("crops");
  const reduce = useReducedMotion();
  const still = usePrefs((s) => s.skipAnimations) || Boolean(reduce);
  const panels = STORY[beat].panels;
  const [i, setI] = useState(0);
  const panel = panels[i]!;
  const last = i === panels.length - 1;
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sfx.meow();
  }, []);
  useEffect(() => {
    box.current?.querySelector<HTMLButtonElement>("button[data-story-next]")?.focus();
  }, [i]);

  const giftLine = !gift
    ? null
    : "tickets" in gift
      ? t("gift.tickets", { n: gift.tickets })
      : t("gift.seed", { n: gift.seed.n, crop: tc(gift.seed.crop) });

  return (
    <div
      ref={box}
      role="dialog"
      aria-modal="true"
      aria-label={t(`${beat}.title`)}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-bg p-4"
    >
      <p className="text-sm font-bold text-muted">{t(`${beat}.title`)}</p>
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl">
        <motion.div
          key={`scene-${i}`}
          initial={still || panel.motion !== "pan" ? false : { x: 12 }}
          animate={{ x: 0 }}
          transition={{ duration: 2.4, ease: "easeOut" }}
        >
          <StoryScene scene={panel.scene} className="aspect-[16/10] w-[104%] -ml-[2%]" />
        </motion.div>
        <motion.div
          key={`som-${i}`}
          className="absolute bottom-[4%] left-1/2 w-[38%] -translate-x-1/2"
          initial={still || panel.motion !== "hop" ? false : { y: 0 }}
          animate={still || panel.motion !== "hop" ? undefined : { y: [0, -14, 0, -6, 0] }}
          transition={{ duration: 0.9 }}
        >
          <SomArt pose={panel.pose} className="h-auto w-full" />
        </motion.div>
        {panel.motion === "sparkle" && (
          <svg aria-hidden="true" viewBox="0 0 160 100" className="pointer-events-none absolute inset-0 h-full w-full">
            {[
              [40, 30, 4],
              [118, 22, 3],
              [128, 54, 2.6],
              [30, 60, 2.4],
            ].map(([x, y, r]) => (
              <motion.g
                key={`${x}`}
                initial={still ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: (x! % 7) / 10 }}
              >
                <Sparkle cx={x!} cy={y!} r={r!} fill="var(--art-yellow)" />
              </motion.g>
            ))}
          </svg>
        )}
      </div>
      <p aria-live="polite" className="min-h-[3.5rem] max-w-md text-center text-lg font-bold leading-snug">
        {t(`${beat}.${panel.line}` as Parameters<typeof t>[0])}
      </p>
      {last && giftLine && <p className="text-base font-extrabold text-primary">{giftLine}</p>}
      <div className="flex gap-3">
        {!last && (
          <Button variant="secondary" onClick={onDone}>
            {t("skip")}
          </Button>
        )}
        <Button data-story-next className="min-w-32" onClick={() => (last ? onDone() : setI(i + 1))}>
          {last ? t("done") : t("next")}
        </Button>
      </div>
      <p className="text-xs text-muted" aria-hidden="true">
        {i + 1} / {panels.length}
      </p>
    </div>
  );
}
