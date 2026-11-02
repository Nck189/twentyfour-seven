"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { TicketArt } from "@/components/art/Ticket";
import { usePrefs } from "@/lib/store/prefs";

const DURATION_MS = 2200;
const DOTS = [0, 60, 120, 180, 240, 300];

/**
 * Reward moment (R8): anticipation (ticket rises, slight squash) → reveal (pop + soft ring) →
 * payoff (+1 label), ≤ 2.5 s, tap anywhere to skip. Skipped entirely with reduced motion or
 * the "skip animations" setting.
 */
export function RewardBurst({
  label,
  kind,
  onDone,
}: {
  label: string;
  kind: "sunrise" | "night";
  onDone: () => void;
}) {
  const reduce = useReducedMotion();
  const skip = usePrefs((s) => s.skipAnimations) || Boolean(reduce);
  const tc = useTranslations("common");

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
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-bg/80"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <div className="relative h-40 w-40">
          {DOTS.map((deg, i) => (
            <motion.span
              key={deg}
              aria-hidden="true"
              className={`absolute top-1/2 left-1/2 h-3 w-3 rounded-full ${i % 2 ? "bg-warn-soft" : "bg-primary-soft"}`}
              initial={{ x: -6, y: -6, scale: 0 }}
              animate={{
                x: Math.cos((deg * Math.PI) / 180) * 70 - 6,
                y: Math.sin((deg * Math.PI) / 180) * 70 - 6,
                scale: [0, 1, 0],
              }}
              transition={{ delay: 0.55, duration: 0.9, ease: "easeOut" }}
            />
          ))}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ y: 60, scale: 0.6, opacity: 0 }}
            animate={{ y: [60, 8, 0], scale: [0.6, 1.12, 1], opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut", times: [0, 0.7, 1] }}
          >
            <TicketArt className="h-24 w-36" kind={kind} />
          </motion.div>
        </div>
        <motion.p
          className="rounded-full bg-surface px-4 py-2 text-lg font-extrabold text-primary"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.25, ease: "easeOut" }}
        >
          {label}
        </motion.p>
      </motion.button>
    </AnimatePresence>
  );
}
