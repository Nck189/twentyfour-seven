"use client";

import { useEffect } from "react";
import type { SkyPhase } from "@/lib/farm/sky";
import { usePrefs } from "@/lib/store/prefs";
import { shouldPlay } from "./quiet";
import { ambienceQuietUntil, playNotes } from "./sfx";

/**
 * Farm ambience (review fix F3): a quiet loop on the Farm tab only, birds by day and crickets
 * at dusk and night, synthesized (no files). Its own switch in Sound & motion, off by default;
 * the mute and "quiet during Focus and Work" still win, and it stops when the tab is hidden.
 */
export type AmbienceKind = "birds" | "crickets";

export function ambienceKind(sky: SkyPhase): AmbienceKind {
  return sky === "dusk" || sky === "night" ? "crickets" : "birds";
}

/** One call of the loop: a bird's two chirps, or a cricket's three pulses (C major, very soft). */
export function ambienceCall(kind: AmbienceKind, variant: number) {
  if (kind === "birds") {
    const [a, b] = variant % 2 ? [2093, 2637] : [2349, 3136];
    return [
      { freq: a, to: b, at: 0, dur: 0.07, type: "sine" as OscillatorType, gain: 0.025 },
      { freq: b, to: a, at: 0.12, dur: 0.09, type: "sine" as OscillatorType, gain: 0.02 },
    ];
  }
  return [0, 0.06, 0.12].map((at) => ({
    freq: 3136,
    at,
    dur: 0.03,
    type: "triangle" as OscillatorType,
    gain: 0.012,
  }));
}

/** Seconds until the next call: birds every 2.5–5 s, crickets every 1.1–1.6 s. */
export function ambienceGap(kind: AmbienceKind, r: number) {
  return kind === "birds" ? 2.5 + r * 2.5 : 1.1 + r * 0.5;
}

export function useAmbience(kind: AmbienceKind | null) {
  const on = usePrefs((s) => s.ambienceOn ?? false);
  useEffect(() => {
    if (!on || !kind) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let n = 0;
    const next = () => {
      timer = setTimeout(
        () => {
          const p = usePrefs.getState();
          const audible =
            document.visibilityState === "visible" &&
            shouldPlay({
              soundOn: p.soundOn,
              autoQuiet: p.autoQuiet ?? true,
              quietUntil: ambienceQuietUntil(),
              now: Date.now(),
            });
          if (audible) playNotes(ambienceCall(kind, n++));
          next();
        },
        ambienceGap(kind, Math.random()) * 1000,
      );
    };
    next();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [on, kind]);
}
