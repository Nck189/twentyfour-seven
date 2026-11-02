import type { BlockKey } from "./blocks";
import type { FixedEvent } from "./defaults";

/**
 * "What's your week like?" starters for first-run setup (Minnie, 2026-11-03): one tap fills
 * kinds of day (weekdays, wake, sleep, fixed class/work time) and first-10 picks; everything
 * stays editable. Names come from i18n `templates.<key>`, event labels from `fixedEvents.<key>`.
 */
export type StarterKind = {
  key: string;
  weekdays: number[];
  wake: string;
  sleepMin: number;
  events: FixedEvent[];
};
export type Starter = {
  key: "student" | "office" | "flex";
  kinds: StarterKind[];
  /** Blocks without a built-in default get suggestion 1; the rest keep their default. */
  first10: Partial<Record<BlockKey, string | null>>;
};

const DAY_OFF = (wake: string): StarterKind => ({
  key: "day_off",
  weekdays: [6, 7],
  wake,
  sleepMin: 480,
  events: [],
});
const FIRST10 = { focus: "@s:focus:1", free: "@s:free:1" };

export const STARTERS: Starter[] = [
  {
    key: "student",
    kinds: [
      {
        key: "school_day",
        weekdays: [1, 2, 3, 4, 5],
        wake: "07:30",
        sleepMin: 480,
        events: [{ id: "class", key: "class", title: null, start: "09:00", end: "16:00" }],
      },
      DAY_OFF("09:00"),
    ],
    first10: FIRST10,
  },
  {
    key: "office",
    kinds: [
      {
        key: "work_day",
        weekdays: [1, 2, 3, 4, 5],
        wake: "07:00",
        sleepMin: 450,
        events: [{ id: "work", key: "work", title: null, start: "09:00", end: "18:00" }],
      },
      DAY_OFF("09:00"),
    ],
    first10: FIRST10,
  },
  {
    key: "flex",
    kinds: [
      { key: "flex_day", weekdays: [1, 2, 3, 4, 5], wake: "08:30", sleepMin: 480, events: [] },
      DAY_OFF("09:30"),
    ],
    first10: FIRST10,
  },
];
