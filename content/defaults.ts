import { DEFAULT_BLOCKS, type BlockKey, type BlockSetting } from "./blocks";

/** Fixed event in a template. `key` = i18n label (`fixedEvents.<key>`); `title` overrides it. */
export type FixedEvent = {
  id: string;
  key: string;
  title: string | null;
  start: string;
  end: string;
  /** Block that holds it (default Work); set for one-off appointments by their time. */
  host?: BlockKey;
};

export type TemplateDefault = {
  key: string;
  weekdays: number[]; // ISO 1=Mon..7=Sun
  auto_apply: boolean;
  target_wake: string; // HH:MM
  options: { attend_toggle?: boolean; alt_target_wake?: string };
  blocks: Partial<Record<BlockKey, Partial<BlockSetting>>>;
  fixed_events: FixedEvent[];
  sort: number;
};

/** Minnie's weekly templates (SPEC §2.2). Names come from i18n `templates.<key>`. */
export const DEFAULT_TEMPLATES: TemplateDefault[] = [
  {
    key: "free_weekday",
    weekdays: [1, 2, 5],
    auto_apply: true,
    target_wake: "10:00",
    options: {},
    blocks: {},
    fixed_events: [],
    sort: 1,
  },
  {
    key: "class_wed",
    weekdays: [3],
    auto_apply: true,
    target_wake: "07:30",
    options: {},
    blocks: {},
    fixed_events: [{ id: "class", key: "class", title: null, start: "09:00", end: "16:00" }],
    sort: 2,
  },
  {
    key: "class_thu",
    weekdays: [4],
    auto_apply: true,
    target_wake: "07:30",
    options: { attend_toggle: true, alt_target_wake: "10:00" },
    blocks: {},
    fixed_events: [{ id: "class", key: "class", title: null, start: "09:00", end: "12:00" }],
    sort: 3,
  },
  {
    key: "family_sat",
    weekdays: [6],
    auto_apply: true,
    target_wake: "10:00",
    options: {},
    blocks: {},
    fixed_events: [{ id: "family", key: "family_out", title: null, start: "12:00", end: "18:00" }],
    sort: 4,
  },
  {
    key: "family_sun",
    weekdays: [7],
    auto_apply: true,
    target_wake: "10:00",
    options: {},
    blocks: {},
    fixed_events: [{ id: "relatives", key: "relatives_dinner", title: null, start: "17:00", end: "20:00" }],
    sort: 5,
  },
  {
    key: "home_weekend",
    weekdays: [6, 7],
    auto_apply: false,
    target_wake: "10:00",
    options: {},
    blocks: {},
    fixed_events: [],
    sort: 6,
  },
];

/** Default project tags (SPEC §5). `key` = i18n label; `label` overrides once edited. */
export const DEFAULT_TAGS = [
  { key: "yop", label: null },
  { key: "senior_project", label: null },
  { key: "class", label: null },
  { key: "personal", label: null },
  { key: "family", label: null },
  { key: "health", label: null },
] as const;

export const DEFAULT_SETTINGS = {
  blocks: DEFAULT_BLOCKS,
  gym_close_time: "22:00",
  weekly_exercise_goal: 3,
  kaizen: { enabled: false, step_min: 15, floor: "08:30", threshold: 5 },
  wake_window_min: 15,
  tags: DEFAULT_TAGS,
};

/** The 7 block plots every new farm starts with (empty). */
export const DEFAULT_PLOT_SLOTS = DEFAULT_BLOCKS.map((b) => b.key);
