"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { SomArt } from "@/components/art/Som";
import { Sparkle } from "@/components/art/farm/parts";
import { Button } from "@/components/ui/Button";
import { STORY, WISH_MAX, type StoryBeatId, type StoryGift } from "@/content/story";
import { getSupabase } from "@/lib/supabase/client";
import { sfx } from "@/lib/sound/sfx";
import { usePrefs } from "@/lib/store/prefs";
import { StoryScene } from "./StoryScene";

/**
 * A short story beat with Som (docs/STORY.md): 3–5 panels, tap Next, Skip any time. With reduced
 * motion or "skip animations" every panel is still. The meow follows the global mute. The gift
 * (already granted by the server) shows on the last panel. A panel with a wish form (Candle
 * Lotus) asks for an optional private wish: "Float it" sends it to the server and plays the last
 * panel; "Not this time" closes the scene and writes nothing.
 */
export function Cutscene({
  beat,
  gift,
  onDone,
  onSettled,
}: {
  beat: StoryBeatId;
  gift: StoryGift | null;
  onDone: () => void;
  /** The scene's lasting part is done (a wish floated): it must not replay even if left now. */
  onSettled?: () => void;
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
  const [wish, setWish] = useState("");
  const [floating, setFloating] = useState(false);
  const [wishError, setWishError] = useState(false);

  // A keyboard (iPad, Mac): Escape skips the scene, like the Skip button (G7 STORY-R14).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDone();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);
  useEffect(() => {
    sfx.meow();
  }, []);
  useEffect(() => {
    box.current?.querySelector<HTMLElement>("[data-story-next]")?.focus();
  }, [i]);

  const float = async () => {
    if (floating || !wish.trim()) return;
    setFloating(true);
    setWishError(false);
    const { error } = await getSupabase().rpc("float_wish", { p_wish: wish.trim() });
    setFloating(false);
    // "Already floated" means a replay after the wish was saved (G7 STORY-R22): that's a success.
    if (error && error.message !== "already floated") {
      setWishError(true);
      return;
    }
    onSettled?.();
    setI(i + 1);
  };

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
          <svg
            aria-hidden="true"
            viewBox="0 0 160 100"
            className="pointer-events-none absolute inset-0 h-full w-full"
          >
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
      {panel.form === "wish" ? (
        <form
          className="flex w-full max-w-md flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void float();
          }}
        >
          <label className="flex flex-col gap-1 text-sm font-bold">
            {t("wish.label")}
            <textarea
              data-story-next
              value={wish}
              maxLength={WISH_MAX}
              rows={4}
              onChange={(e) => setWish(e.target.value)}
              placeholder={t("wish.placeholder")}
              className="min-h-11 resize-none rounded-xl bg-surface-2 px-3 py-2 leading-relaxed font-normal"
            />
          </label>
          <p className="text-xs text-muted">{t("wish.private", { n: WISH_MAX - wish.length })}</p>
          {wishError && (
            <p role="alert" className="text-sm font-bold text-accent">
              {t("wish.error")}
            </p>
          )}
          <div className="flex justify-center gap-3">
            <Button type="button" variant="secondary" onClick={onDone}>
              {t("wish.skip")}
            </Button>
            <Button type="submit" className="min-w-32" disabled={floating || !wish.trim()}>
              {t("wish.float")}
            </Button>
          </div>
        </form>
      ) : (
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
      )}
      <p className="text-xs text-muted" aria-hidden="true">
        {i + 1} / {panels.length}
      </p>
    </div>
  );
}
