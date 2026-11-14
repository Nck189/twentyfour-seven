/**
 * Estimate vs actual (M14, SPEC §9 "planning-fallacy analytics"), pure. A finished task with an
 * estimate can get its real minutes in one tap; Stats shows how far estimates run, in plain words.
 */
export type EstimatedTask = { estimate_min: number | null; actual_min: number | null; tag: string | null };

const round5 = (m: number) => Math.max(5, Math.round(m / 5) * 5);

/** One-tap answers for "how long did it take?": about half, as planned, ×1.5, ×2, ×3. */
export function actualChoices(estimateMin: number): number[] {
  const e = Math.max(1, Math.round(estimateMin));
  return [...new Set([round5(e * 0.5), e, round5(e * 1.5), round5(e * 2), round5(e * 3)])]
    .filter((m) => m >= 1 && m <= 1440)
    .sort((a, b) => a - b);
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** At least this many answered tasks before a ratio is shown (overall and per tag). */
export const MIN_TASKS = 5;
export const MIN_PER_TAG = 3;

export type EstimateSummary = {
  n: number;
  /** Median actual ÷ estimate: 1.4 = tasks take about 40% longer than planned. */
  ratio: number;
  /** Share of tasks that took longer than estimated (0..1). */
  overShare: number;
  byTag: { tag: string; n: number; ratio: number }[];
};

export function estimateSummary(tasks: readonly EstimatedTask[]): EstimateSummary | null {
  const done = tasks.filter(
    (t): t is EstimatedTask & { estimate_min: number; actual_min: number } =>
      (t.estimate_min ?? 0) > 0 && (t.actual_min ?? 0) > 0,
  );
  if (done.length < MIN_TASKS) return null;
  const ratios = done.map((t) => t.actual_min / t.estimate_min);
  const tags = new Map<string, number[]>();
  for (const t of done)
    if (t.tag) tags.set(t.tag, [...(tags.get(t.tag) ?? []), t.actual_min / t.estimate_min]);
  return {
    n: done.length,
    ratio: Math.round(median(ratios) * 100) / 100,
    overShare: done.filter((t) => t.actual_min > t.estimate_min).length / done.length,
    byTag: [...tags]
      .filter(([, r]) => r.length >= MIN_PER_TAG)
      .map(([tag, r]) => ({ tag, n: r.length, ratio: Math.round(median(r) * 100) / 100 }))
      .sort((a, b) => b.ratio - a.ratio),
  };
}
