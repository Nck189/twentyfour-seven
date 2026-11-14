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
};

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
