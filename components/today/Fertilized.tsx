"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Art, Sparkle } from "@/components/art/farm/parts";
import { usePrefs } from "@/lib/store/prefs";

/**
 * Right after a live first-10: the block's plot got its "fertilizer" (it raises the crop's
 * quality and its market price). Shown so the reward is visible at the moment of the tap.
 */
export function Fertilized({ text }: { text: string }) {
  const reduce = useReducedMotion();
  const skip = usePrefs((s) => s.skipAnimations) || Boolean(reduce);
  return (
    <motion.p
      role="status"
      className="mt-1 flex items-center gap-1.5 text-sm font-bold text-primary"
      initial={skip ? false : { opacity: 0, y: 4, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25 }}
    >
      <motion.span
        aria-hidden="true"
        className="inline-flex"
        initial={skip ? false : { rotate: -30, scale: 0.4 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 14 }}
      >
        <Art className="h-5 w-5">
          <Sparkle cx={24} cy={24} r={18} fill="var(--art-yellow)" />
          <Sparkle cx={36} cy={12} r={7} fill="var(--art-yellow-light)" />
        </Art>
      </motion.span>
      {text}
    </motion.p>
  );
}
