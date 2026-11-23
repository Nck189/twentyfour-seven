import { DAY_ORDER, type BlockKey } from "@/content/blocks";

/**
 * Which plots grew a stage since this device last showed the farm (review fix F1/F2): they get
 * a pop and a small step-up. Pure, plus a tiny per-device memory of the stages last shown.
 */
type PlotLike = { cropId: string; stage: number; plantedKey: string };
export type StageSnapshot = Partial<Record<BlockKey, string>>;

const key = (p: PlotLike) => `${p.cropId}|${p.plantedKey}|${p.stage}`;

export function snapshot(plots: Partial<Record<BlockKey, PlotLike>>): StageSnapshot {
  const out: StageSnapshot = {};
  for (const b of DAY_ORDER) {
    const p = plots[b];
    if (p) out[b] = key(p);
  }
  return out;
}

/** Plots (in day order) whose same planting is at a higher stage than last time. */
export function grownSince(
  before: StageSnapshot | null,
  now: Partial<Record<BlockKey, PlotLike>>,
): BlockKey[] {
  if (!before) return [];
  return DAY_ORDER.filter((b) => {
    const p = now[b];
    const was = before[b]?.split("|");
    if (!p || !was || was.length !== 3) return false;
    const [crop, planted, stage] = was;
    const n = Number(stage);
    return crop === p.cropId && planted === p.plantedKey && Number.isFinite(n) && p.stage > n;
  });
}

const STORE = "247-farm-stages";

export function readSeen(userId: string): StageSnapshot | null {
  try {
    const all = JSON.parse(localStorage.getItem(STORE) ?? "{}") as Record<string, StageSnapshot>;
    return all[userId] ?? null;
  } catch {
    return null;
  }
}

export function writeSeen(userId: string, s: StageSnapshot) {
  try {
    const all = JSON.parse(localStorage.getItem(STORE) ?? "{}") as Record<string, StageSnapshot>;
    localStorage.setItem(STORE, JSON.stringify({ ...all, [userId]: s }));
  } catch {
    // Private mode / full storage: the next visit just shows no growth.
  }
}
