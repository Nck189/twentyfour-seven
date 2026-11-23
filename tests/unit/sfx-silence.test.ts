import { afterEach, beforeEach, describe, expect, it } from "vitest";

/** Review fix F1 / G7 F-4: every sound is silent when muted, in a quiet block, or before audio runs. */
let started = 0;
let ctxState: AudioContextState | "interrupted" = "running";

class FakeParam {
  setValueAtTime() {}
  exponentialRampToValueAtTime() {}
}
class FakeNode {
  frequency = new FakeParam();
  gain = new FakeParam();
  type = "sine";
  connect() {
    return this;
  }
  start() {
    started++;
  }
  stop() {}
}
class FakeContext {
  get state() {
    return ctxState;
  }
  currentTime = 0;
  destination = {};
  createOscillator() {
    return new FakeNode();
  }
  createGain() {
    return new FakeNode();
  }
  resume() {
    return Promise.resolve();
  }
}

beforeEach(() => {
  (globalThis as unknown as { window: unknown }).window = { AudioContext: FakeContext };
  started = 0;
  ctxState = "running";
});
afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

async function load() {
  const { sfx, setQuietUntil, playNotes } = await import("@/lib/sound/sfx");
  const { usePrefs } = await import("@/lib/store/prefs");
  return { sfx, setQuietUntil, playNotes, usePrefs };
}

const EVERY: [string, unknown[]][] = [
  ["tick", []],
  ["blockStart", []],
  ["sparkle", []],
  ["blockDone", [true]],
  ["ritualStep", []],
  ["plant", []],
  ["grow", [3]],
  ["buy", []],
  ["deliver", []],
  ["machine", []],
  ["clink", []],
  ["munch", []],
  ["enough", []],
  ["error", []],
  ["celebrate", [2]],
  ["sunrise", []],
  ["harvest", []],
  ["coin", []],
  ["jingle", [2]],
];

describe("sounds stay silent when they should", () => {
  it("they play when sound is on and nothing is quiet", async () => {
    const { sfx, setQuietUntil, usePrefs } = await load();
    usePrefs.setState({ soundOn: true, autoQuiet: true });
    setQuietUntil(0);
    for (const [name, args] of EVERY) {
      started = 0;
      (sfx as unknown as Record<string, (...a: unknown[]) => void>)[name]!(...args);
      expect(started, name).toBeGreaterThan(0);
    }
  });
  it("muted: nothing plays, the ambience neither", async () => {
    const { sfx, setQuietUntil, playNotes, usePrefs } = await load();
    usePrefs.setState({ soundOn: false });
    setQuietUntil(0);
    for (const [name, args] of EVERY)
      (sfx as unknown as Record<string, (...a: unknown[]) => void>)[name]!(...args);
    playNotes([{ freq: 2093, at: 0, dur: 0.05 }]);
    expect(started).toBe(0);
  });
  it("in a Focus/Work quiet block: nothing plays, except a timer the user set", async () => {
    const { sfx, setQuietUntil, playNotes, usePrefs } = await load();
    usePrefs.setState({ soundOn: true, autoQuiet: true });
    setQuietUntil(Date.now() + 60_000);
    for (const [name, args] of EVERY)
      (sfx as unknown as Record<string, (...a: unknown[]) => void>)[name]!(...args);
    playNotes([{ freq: 2093, at: 0, dur: 0.05 }]);
    expect(started).toBe(0);
    sfx.alarm();
    expect(started).toBeGreaterThan(0);
    setQuietUntil(0);
  });
  it("before audio runs (no tap yet, or iOS interrupted it): sounds are dropped, not queued (G7 F-1)", async () => {
    const { sfx, setQuietUntil, usePrefs } = await load();
    usePrefs.setState({ soundOn: true, autoQuiet: true });
    setQuietUntil(0);
    for (const s of ["suspended", "interrupted"] as const) {
      ctxState = s;
      sfx.grow(5);
      sfx.celebrate(1);
    }
    expect(started).toBe(0);
  });
});
