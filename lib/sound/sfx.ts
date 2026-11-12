"use client";

import { usePrefs } from "@/lib/store/prefs";
import { shouldPlay } from "./quiet";

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

/** End of the current Focus/Work block (ms), set by Today; 0 = not in a quiet block. */
let quietUntil = 0;
export function setQuietUntil(ms: number) {
  quietUntil = ms;
}

function play(notes: Note[], essential = false) {
  const p = usePrefs.getState();
  if (
    !shouldPlay({
      soundOn: p.soundOn,
      autoQuiet: p.autoQuiet ?? true,
      quietUntil,
      now: Date.now(),
      essential,
    })
  )
    return;
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
  /** Capsule machine: a soft rattle while it shakes. */
  shake: () =>
    play(
      [0, 0.08, 0.16, 0.24].map((at, i) => ({
        freq: i % 2 ? 300 : 340,
        at,
        dur: 0.05,
        type: "triangle" as OscillatorType,
        gain: 0.08,
      })),
    ),
  /** The capsule cracks open. */
  crack: () =>
    play([
      { freq: 180, at: 0, dur: 0.05, type: "square", gain: 0.08 },
      { freq: 520, at: 0.03, dur: 0.08, type: "triangle", gain: 0.15 },
    ]),
  /** Reveal jingle: the higher the rarity (0 common … 4 legendary), the higher and longer it goes. */
  jingle: (rank: number) => {
    const scale = [523, 587, 659, 784, 880, 988, 1047, 1175, 1319];
    const notes = Array.from({ length: 3 + rank }, (_, i) => ({
      freq: scale[Math.min(scale.length - 1, i + rank)]!,
      at: i * 0.09,
      dur: 0.14,
      type: "triangle" as OscillatorType,
      gain: 0.14,
    }));
    play(notes);
  },
  /** Pet reaction: a short two-note call, pitched per animal (small = high); sleepy = low and soft. */
  animal: (pitch: number, sleepy = false) =>
    play(
      sleepy
        ? [{ freq: pitch * 0.5, at: 0, dur: 0.3, type: "sine", gain: 0.08 }]
        : [
            { freq: pitch, at: 0, dur: 0.09, type: "triangle", gain: 0.16 },
            { freq: pitch * 1.26, at: 0.08, dur: 0.12, type: "triangle", gain: 0.14 },
          ],
    ),
  /** An egg hatches: wobble taps, a crack, then a rising chirp. */
  hatch: () =>
    play([
      { freq: 300, at: 0, dur: 0.05, type: "triangle", gain: 0.08 },
      { freq: 320, at: 0.12, dur: 0.05, type: "triangle", gain: 0.08 },
      { freq: 520, at: 0.3, dur: 0.07, type: "triangle", gain: 0.14 },
      { freq: 880, at: 0.42, dur: 0.1, type: "sine", gain: 0.18 },
      { freq: 1175, at: 0.52, dur: 0.16, type: "sine", gain: 0.14 },
    ]),
  sunrise: () =>
    play([
      { freq: 523, at: 0, dur: 0.15 },
      { freq: 659, at: 0.1, dur: 0.15 },
      { freq: 784, at: 0.2, dur: 0.25 },
    ]),
  /** A timer the user set (power nap): rings even during a quiet block (never when muted). */
  alarm: () =>
    play(
      [0, 0.25, 0.5].flatMap((at) => [
        { freq: 988, at, dur: 0.12, type: "square" as OscillatorType, gain: 0.15 },
        { freq: 784, at: at + 0.12, dur: 0.1, type: "square" as OscillatorType, gain: 0.12 },
      ]),
      true,
    ),
  /** Goodnight: a soft 2-second lullaby, falling. */
  lullaby: () =>
    play(
      [784, 659, 587, 523, 392].map((freq, i) => ({
        freq,
        at: i * 0.38,
        dur: 0.55,
        type: "sine" as OscillatorType,
        gain: 0.1,
      })),
    ),
  /** Coins earned: a bright two-note clink (separate from the harvest). */
  coin: () =>
    play([
      { freq: 1568, at: 0, dur: 0.07, type: "triangle", gain: 0.12 },
      { freq: 2093, at: 0.06, dur: 0.16, type: "triangle", gain: 0.1 },
    ]),
  /** A streak milestone or welcome back: a soft rising celebration. */
  celebrate: () =>
    play(
      [523, 659, 784, 1047, 784, 1047].map((freq, i) => ({
        freq,
        at: i * 0.1,
        dur: i === 5 ? 0.35 : 0.12,
        type: "triangle" as OscillatorType,
        gain: 0.12,
      })),
    ),
  /** Som: a short meow (a pitch glide up, then down). */
  meow: () => {
    const p = usePrefs.getState();
    if (!shouldPlay({ soundOn: p.soundOn, autoQuiet: p.autoQuiet ?? true, quietUntil, now: Date.now() }))
      return;
    const ac = audio();
    if (!ac) return;
    const t0 = ac.currentTime + 0.01;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(520, t0);
    osc.frequency.exponentialRampToValueAtTime(880, t0 + 0.12);
    osc.frequency.exponentialRampToValueAtTime(560, t0 + 0.38);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.14, t0 + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);
    osc.connect(g).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + 0.45);
  },
};
