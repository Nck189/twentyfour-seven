import { BLOCKS_WITHOUT_DEFAULT_FIRST10, type BlockKey } from "@/content/blocks";

/**
 * First-run setup (Minnie, 2026-11-03): sleep targets per kind of day and each block's
 * first-10 choices. Pure helpers; the UI lives in components/onboarding.
 */

/** Stored in `profiles.onboarding`. */
export type OnboardingState = { done?: boolean; skipped?: boolean; at?: string; [k: string]: unknown };

export function needsOnboarding(state: OnboardingState | null | undefined): boolean {
  return !state?.done && !state?.skipped;
}

/** `first10 = ""` means the user chose no first-10 for that block. */
export const NONE = "";

/** Built-in suggestion n of a block, stored as a token so it follows the app language. */
export const suggestionToken = (key: BlockKey, n: number) => `@s:${key}:${n}`;
export const isSuggestion = (v: string | null) => typeof v === "string" && v.startsWith("@s:");
export function parseSuggestion(v: string): { key: BlockKey; n: number } | null {
  const m = /^@s:([a-z]+):(\d)$/.exec(v);
  return m ? { key: m[1] as BlockKey, n: Number(m[2]) } : null;
}

/**
 * What a first-10 text box shows for a stored value: a built-in suggestion as its words (the
 * token is storage, not text; playtest R1 P4), the user's own text as is, nothing for none.
 */
export function editableFirst10(raw: string | null, words: (raw: string) => string | null): string {
  if (!raw) return "";
  return isSuggestion(raw) ? (words(raw) ?? "") : raw;
}

/**
 * Every first-10 a block offers: the built-in default (null) where there is one, the
 * suggestions, then the user's own texts (deduped). Blocks without a built-in default get 3.
 */
export function first10Options(key: BlockKey, own: string[]): (string | null)[] {
  const hasDefault = !BLOCKS_WITHOUT_DEFAULT_FIRST10.includes(key);
  const suggestions = hasDefault ? [1, 2] : [1, 2, 3];
  const custom = [...new Set(own.map((s) => s.trim()).filter(Boolean))];
  return [...(hasDefault ? [null] : []), ...suggestions.map((n) => suggestionToken(key, n)), ...custom];
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const toHHMM = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** Sleep length from bed → wake (crosses midnight). null when outside 3–12 h. */
export function sleepMinutes(bed: string, wake: string): number | null {
  const d = (toMin(wake) - toMin(bed) + 1440) % 1440;
  return d >= 180 && d <= 720 ? d : null;
}

export function bedtimeFor(wake: string, sleepMin: number): string {
  return toHHMM(toMin(wake) - sleepMin);
}
