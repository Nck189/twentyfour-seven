"use client";

import { useEffect } from "react";
import { unlockAudio } from "@/lib/sound/sfx";

/** iOS: audio may only start after a user gesture, so unlock on the first tap anywhere. */
export function SoundUnlock() {
  useEffect(() => {
    const unlock = () => {
      unlockAudio();
      window.removeEventListener("pointerdown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);
  return null;
}
