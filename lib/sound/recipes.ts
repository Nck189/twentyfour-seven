/**
 * The notes of the Phase F sounds (review fix F1), kept pure so they can be checked: every pitch
 * is a C-major note (so all sounds belong to one set), every sound is short and soft. `sfx.ts`
 * plays them; `docs/SOUND-MAP.md` says which moment uses which.
 */
export type Note = {
  freq: number;
  at: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  /** Glide to this pitch over the note (a rising or falling note). */
  to?: number;
};

/** C major, C3–G7 (Hz, rounded as the existing sounds already are). */
export const C_MAJOR = [
  131, 147, 165, 175, 196, 220, 247, 262, 294, 330, 349, 392, 440, 494, 523, 587, 659, 698, 784, 880, 988,
  1047, 1175, 1319, 1397, 1568, 1760, 1976, 2093, 2349, 2637, 2794, 3136,
] as const;

export const RECIPES = {
  /** Start a block: one soft rising note. */
  blockStart: (): Note[] => [{ freq: 523, to: 784, at: 0, dur: 0.18, type: "sine", gain: 0.14 }],
  /** First 10 minutes done: a small sparkle (the plot sparkles too). */
  sparkle: (): Note[] => [
    { freq: 1568, at: 0, dur: 0.07, type: "triangle", gain: 0.1 },
    { freq: 2093, at: 0.05, dur: 0.08, type: "triangle", gain: 0.09 },
    { freq: 2637, at: 0.1, dur: 0.14, type: "sine", gain: 0.08 },
  ],
  /** Finish a block: two rising notes; three when every checklist item is ticked. */
  blockDone: (all: boolean): Note[] =>
    [659, 784, ...(all ? [1047] : [])].map((freq, i, a) => ({
      freq,
      at: i * 0.1,
      dur: i === a.length - 1 ? 0.22 : 0.1,
      type: "triangle" as OscillatorType,
      gain: 0.14,
    })),
  /** "I'm up" in the window: the sunrise, a little longer. */
  sunrise: (): Note[] => [
    { freq: 523, at: 0, dur: 0.15 },
    { freq: 659, at: 0.1, dur: 0.15 },
    { freq: 784, at: 0.2, dur: 0.18 },
    { freq: 1047, at: 0.32, dur: 0.35, gain: 0.14 },
  ],
  /** Each step of the Night ritual: a soft low tick. */
  ritualStep: (): Note[] => [{ freq: 262, at: 0, dur: 0.07, type: "sine", gain: 0.12 }],
  /** Plant a seed: a soft "pat" into the soil. */
  plant: (): Note[] => [
    { freq: 196, at: 0, dur: 0.06, type: "triangle", gain: 0.16 },
    { freq: 262, at: 0.04, dur: 0.06, type: "sine", gain: 0.08 },
  ],
  /** Crops that grew since the last visit: a light pop per plot, staggered, rising. */
  grow: (n: number): Note[] =>
    Array.from({ length: Math.max(0, Math.min(7, n)) }, (_, i) => ({
      freq: [659, 784, 880, 1047, 1175, 1319, 1568][i]!,
      at: i * 0.12,
      dur: 0.08,
      type: "sine" as OscillatorType,
      gain: 0.14,
    })),
  /** Buy or upgrade: a warm two-note "kaching", lower than the sell coin. */
  buy: (): Note[] => [
    { freq: 523, at: 0, dur: 0.06, type: "triangle", gain: 0.14 },
    { freq: 659, at: 0, dur: 0.06, type: "triangle", gain: 0.1 },
    { freq: 1047, at: 0.07, dur: 0.2, type: "triangle", gain: 0.12 },
  ],
  /** An order delivered, the factory collected: the coin and a short flourish. */
  deliver: (): Note[] => [
    { freq: 1568, at: 0, dur: 0.07, type: "triangle", gain: 0.12 },
    { freq: 2093, at: 0.06, dur: 0.1, type: "triangle", gain: 0.1 },
    { freq: 1319, at: 0.16, dur: 0.07, type: "sine", gain: 0.1 },
    { freq: 1568, at: 0.22, dur: 0.07, type: "sine", gain: 0.1 },
    { freq: 2093, at: 0.28, dur: 0.18, type: "sine", gain: 0.1 },
  ],
  /** A factory job started: a low mechanical click. */
  machine: (): Note[] => [
    { freq: 131, at: 0, dur: 0.03, type: "square", gain: 0.06 },
    { freq: 196, at: 0.06, dur: 0.03, type: "square", gain: 0.06 },
  ],
  /** A café order: a cup clink. */
  clink: (): Note[] => [
    { freq: 2637, at: 0, dur: 0.05, type: "sine", gain: 0.09 },
    { freq: 3136, at: 0.04, dur: 0.12, type: "sine", gain: 0.07 },
  ],
  /** Feed an animal: a munch. */
  munch: (): Note[] =>
    [0, 0.09, 0.18].map((at, i) => ({
      freq: i === 1 ? 196 : 220,
      at,
      dur: 0.05,
      type: "triangle" as OscillatorType,
      gain: 0.12,
    })),
  /** Pets used up for today: a soft "that's enough" note, falling. */
  enough: (): Note[] => [{ freq: 392, to: 330, at: 0, dur: 0.25, type: "sine", gain: 0.08 }],
  /** Something failed to save: one low, short note (never harsh). */
  error: (): Note[] => [{ freq: 196, at: 0, dur: 0.18, type: "sine", gain: 0.1 }],
  /** Unlock, streak milestone, perfect day: the bigger it is (0–2), the higher the last note. */
  celebrate: (size = 0): Note[] =>
    [523, 659, 784, 1047, 784, [1047, 1319, 1568][Math.max(0, Math.min(2, size))]!].map((freq, i) => ({
      freq,
      at: i * 0.1,
      dur: i === 5 ? 0.35 : 0.12,
      type: "triangle" as OscillatorType,
      gain: 0.12,
    })),
} as const;

export type SoundName = keyof typeof RECIPES;

/** The sound a Shop action makes, from its key (`order-…`, `seed-…`, `up-…`, `sell…`). */
export function shopSound(key: string): "deliver" | "buy" | "coin" | "tick" {
  if (key.startsWith("order")) return "deliver";
  if (key.startsWith("seed-") || key.startsWith("up-") || key === "exchange" || key.startsWith("redeem-"))
    return "buy";
  if (key.startsWith("sell")) return "coin";
  return "tick";
}
