/** The 7 blocks in chain order (SPEC §2.1). Labels/first-10 defaults come from i18n `blocks.*`. */
export const BLOCK_KEYS = ["down", "sleep", "wake", "focus", "work", "gradation", "free"] as const;
export type BlockKey = (typeof BLOCK_KEYS)[number];
/** The blocks in the order a day is lived: Wake first, Sleep last (Minnie 2026-11-14: the farm reads like the day). */
export const DAY_ORDER: readonly BlockKey[] = ["wake", "focus", "work", "gradation", "free", "down", "sleep"];

export type ChecklistItem = { id: string; label: string };

export type BlockSetting = {
  key: BlockKey;
  duration_min: number;
  /**
   * null = the built-in default text (`blocks.first10.<key>`); "" = no first-10 for this block;
   * "@s:<key>:<n>" = built-in suggestion n (follows the app language); anything else = own text.
   */
  first10: string | null;
  /** The user's own first-10 texts to pick from (in addition to the built-in ones). */
  first10_options?: string[];
  checklist: ChecklistItem[];
  /**
   * Rule B (Minnie OK 2026-11-27): which days this block is tracked, as dated changes, oldest
   * first; a day reads the last entry on or before it (none = tracked). Written only by the
   * `set_block_tracked` RPC (from the next wake-day), so a change never rewrites a past day.
   * An untracked block keeps its time on Today with no check-in, no Night-ritual question, no
   * reminder and no place in the Day score; its plot grows on every kept day instead.
   */
  tracked_log?: { from: string; tracked: boolean }[];
};

/** Always tracked: the day's anchors (I'm up, the Night ritual, going to bed). */
export const CORE_BLOCKS: readonly BlockKey[] = ["wake", "down", "sleep"];
/** The blocks a person may choose to track or not. */
export const OPTIONAL_BLOCKS: readonly BlockKey[] = ["focus", "work", "gradation", "free"];

type Tracked = Pick<BlockSetting, "key" | "tracked_log">;

/** Tracked on `date` (YYYY-MM-DD)? Core blocks always are. Mirrored in SQL `_untracked_on`. */
export function trackedOn(blocks: readonly Tracked[], key: BlockKey, date: string): boolean {
  if (CORE_BLOCKS.includes(key)) return true;
  const log = blocks.find((b) => b.key === key)?.tracked_log ?? [];
  let tracked = true;
  for (const e of log) if (e.from <= date) tracked = e.tracked;
  return tracked;
}

/** The latest choice (what the settings switch shows), whenever it starts. */
export function isTracked(blocks: readonly Tracked[], key: BlockKey): boolean {
  if (CORE_BLOCKS.includes(key)) return true;
  return blocks.find((b) => b.key === key)?.tracked_log?.at(-1)?.tracked ?? true;
}

/** Blocks not tracked on `date`. */
export function untrackedOn(blocks: readonly Tracked[], date: string): BlockKey[] {
  return OPTIONAL_BLOCKS.filter((k) => !trackedOn(blocks, k, date));
}

/** Blocks the latest choice leaves untracked (some may start only tomorrow). */
export function untrackedBlocks(blocks: readonly Tracked[]): BlockKey[] {
  return OPTIONAL_BLOCKS.filter((k) => !isTracked(blocks, k));
}

/** Book defaults; durations sum to 24h. */
export const DEFAULT_BLOCKS: BlockSetting[] = [
  { key: "down", duration_min: 90, first10: null, checklist: [] },
  { key: "sleep", duration_min: 450, first10: null, checklist: [] },
  { key: "wake", duration_min: 60, first10: null, checklist: [] },
  { key: "focus", duration_min: 90, first10: null, checklist: [] },
  { key: "work", duration_min: 540, first10: null, checklist: [] },
  { key: "gradation", duration_min: 60, first10: null, checklist: [] },
  { key: "free", duration_min: 150, first10: null, checklist: [] },
];

/** Blocks whose default first-10 is user-defined (no default text). */
export const BLOCKS_WITHOUT_DEFAULT_FIRST10: BlockKey[] = ["focus", "free"];
