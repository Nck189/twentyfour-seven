"use client";

import { usePrefs } from "@/lib/store/prefs";

/**
 * Tiny WebAudio synth for short SFX (no audio files). iOS only allows audio after a user
 * gesture, so the context is created/resumed on the first tap. Every sound respects mute.
 */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Call once from any user gesture (done globally by SoundUnlock). */
export function unlockAudio() {
  audio();
}

type Note = { freq: number; at: number; dur: number; type?: OscillatorType; gain?: number };

function play(notes: Note[]) {
  if (!usePrefs.getState().soundOn) return;
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + 0.01;
  for (const n of notes) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = n.type ?? "sine";
    osc.frequency.setValueAtTime(n.freq, t0 + n.at);
    g.gain.setValueAtTime(0.0001, t0 + n.at);
    g.gain.exponentialRampToValueAtTime(n.gain ?? 0.2, t0 + n.at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur);
    osc.connect(g).connect(ac.destination);
    osc.start(t0 + n.at);
    osc.stop(t0 + n.at + n.dur + 0.02);
  }
}

export const sfx = {
  tick: () => play([{ freq: 880, at: 0, dur: 0.06, type: "triangle", gain: 0.12 }]),
  untick: () => play([{ freq: 520, at: 0, dur: 0.05, type: "triangle", gain: 0.08 }]),
  pop: () =>
    play([
      { freq: 660, at: 0, dur: 0.08, type: "sine", gain: 0.25 },
      { freq: 990, at: 0.05, dur: 0.12, type: "sine", gain: 0.2 },
    ]),
  /** Juicy harvest: a quick rising "bloop" and a bright sparkle on top. */
  harvest: () =>
    play([
      { freq: 392, at: 0, dur: 0.07, type: "sine", gain: 0.22 },
      { freq: 587, at: 0.04, dur: 0.09, type: "sine", gain: 0.24 },
      { freq: 880, at: 0.1, dur: 0.12, type: "triangle", gain: 0.16 },
      { freq: 1319, at: 0.17, dur: 0.16, type: "triangle", gain: 0.1 },
    ]),
  sunrise: () =>
    play([
      { freq: 523, at: 0, dur: 0.15 },
      { freq: 659, at: 0.1, dur: 0.15 },
      { freq: 784, at: 0.2, dur: 0.25 },
    ]),
  alarm: () =>
    play(
      [0, 0.25, 0.5].flatMap((at) => [
        { freq: 988, at, dur: 0.12, type: "square" as OscillatorType, gain: 0.15 },
        { freq: 784, at: at + 0.12, dur: 0.1, type: "square" as OscillatorType, gain: 0.12 },
      ]),
    ),
};
