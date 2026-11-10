"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useEffect, useRef, type ReactNode } from "react";
import { AppMark } from "@/components/art/AppMark";
import { ExerciseArt } from "@/components/art/Exercise";
import { CapsuleMachine } from "@/components/art/farm/Capsule";
import { ScarecrowArt, StreakSun } from "@/components/art/Streak";
import { TicketArt } from "@/components/art/Ticket";
import type { TipId } from "@/content/tips";
import { usePrefs } from "@/lib/store/prefs";
import { useTip } from "@/lib/tips/useTips";

const ART: Record<TipId, ReactNode> = {
  wake: <TicketArt className="h-8 w-12" kind="sunrise" />,
  first10: <StreakSun className="h-10 w-10" />,
  night: <TicketArt className="h-8 w-12" kind="night" />,
  exercise: <ExerciseArt type="run" className="h-10 w-10" />,
  streak: <ScarecrowArt className="h-10 w-10" />,
  plan: <AppMark className="h-10 w-10" />,
  plots: <AppMark className="h-10 w-10" />,
  capsule: <CapsuleMachine className="h-10 w-10" />,
};

/**
 * A first-time tip (BUILD_PLAN M10): a small bubble right under the feature it explains, shown
 * once per account, one at a time. "Got it" closes it; "Skip all tips" turns them all off.
 */
export function Tip({ id, when = true, className = "" }: { id: TipId; when?: boolean; className?: string }) {
  const t = useTranslations("tips");
  const { show, dismiss, skipAll } = useTip(id, when);
  const reduce = useReducedMotion();
  const skipAnim = usePrefs((s) => s.skipAnimations) || Boolean(reduce);
  const box = useRef<HTMLElement>(null);
  // A tap anywhere outside the bubble closes it too (it has been seen). "click", not
  // "pointerdown": a scroll starts with a pointerdown on touch screens (G7 R-M10-R1).
  useEffect(() => {
    if (!show) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) dismiss();
    };
    document.addEventListener("click", onDown, true);
    return () => document.removeEventListener("click", onDown, true);
  }, [show, dismiss]);
  if (!show) return null;
  return (
    <motion.aside
      ref={box}
      aria-label={t("label")}
      initial={skipAnim ? false : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`relative mx-4 mb-3 rounded-[var(--radius-lg)] bg-primary-soft p-3 lg:mx-6 ${className}`}
    >
      <span
        aria-hidden="true"
        className="absolute -top-1.5 left-8 h-3 w-3 rotate-45 rounded-[2px] bg-primary-soft"
      />
      <div className="flex items-start gap-3">
        <span className="shrink-0" aria-hidden="true">
          {ART[id]}
        </span>
        <p className="min-w-0 flex-1 text-sm">{t(`text.${id}`)}</p>
      </div>
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={skipAll}
          className="tap min-h-11 rounded-xl px-3 text-sm font-bold text-muted"
        >
          {t("skipAll")}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="tap min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-on-primary"
        >
          {t("gotIt")}
        </button>
      </div>
    </motion.aside>
  );
}
