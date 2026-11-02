import type { BlockKey } from "@/content/blocks";
import type { DayPlan } from "@/lib/engine";

/**
 * Backlog rules (SPEC §5). Pure: no I/O. Items mirror the `backlog_items` table.
 */

export type Priority = "must" | "should" | "just_start";
export type BacklogStatus = "inbox" | "scheduled" | "done" | "dropped";
export type ChecklistEntry = { id: string; label: string; done: boolean };

export type BacklogItem = {
  id: string;
  title: string;
  tag: string | null;
  estimate_min: number | null;
  priority: Priority;
  deadline: string | null;
  scheduled_date: string | null;
  block: BlockKey | null;
  status: BacklogStatus;
  carry_count: number;
  checklist: ChecklistEntry[];
  done_at: string | null;
  created_at: string;
};

/** A deadline this many days away (or less, or overdue) floats to the top. */
export const NEAR_DEADLINE_DAYS = 3;
/** Items land in Work unless they were dropped onto another block. */
export const DEFAULT_BLOCK: BlockKey = "work";

const PRIORITY_RANK: Record<Priority, number> = { must: 0, should: 1, just_start: 2 };
const DAY = 86_400_000;

/** Whole calendar days from `from` to `to` (YYYY-MM-DD); negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const ms = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    return Date.UTC(y, m - 1, day);
  };
  return Math.round((ms(to) - ms(from)) / DAY);
}

/**
 * Near or overdue deadlines first (soonest first); then Must > Should > Just start; then any
 * deadline before none (soonest first); then oldest first.
 */
export function sortBacklog<T extends BacklogItem>(items: T[], today: string): T[] {
  const near = (i: T) => i.deadline !== null && daysBetween(today, i.deadline) <= NEAR_DEADLINE_DAYS;
  return [...items].sort((a, b) => {
    const na = near(a);
    const nb = near(b);
    if (na !== nb) return na ? -1 : 1;
    if (na && nb) return a.deadline!.localeCompare(b.deadline!);
    const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (pr !== 0) return pr;
    if (a.deadline !== b.deadline) {
      if (a.deadline === null) return 1;
      if (b.deadline === null) return -1;
      return a.deadline.localeCompare(b.deadline);
    }
    return a.created_at.localeCompare(b.created_at);
  });
}

const overlapMin = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  Math.max(0, Math.min(aEnd.getTime(), bEnd.getTime()) - Math.max(aStart.getTime(), bStart.getTime())) /
  60_000;

/** Minutes of a block not taken by fixed events (a class inside Work isn't free time). */
export function freeMinutes(plan: DayPlan, block: BlockKey): number {
  const b = plan.blocks.find((x) => x.key === block && x.start.getTime() >= plan.bedtime.getTime());
  if (!b) return 0;
  const busy = plan.fixedEvents.reduce((sum, e) => sum + overlapMin(b.start, b.end, e.start, e.end), 0);
  return Math.max(0, Math.round(b.durationMin - busy));
}

export type DayCapacity = {
  /** Free minutes in the target blocks (Work, plus any block an item was dropped onto). */
  capacityMin: number;
  /** Sum of estimates of the day's items (dropped items excluded). */
  loadMin: number;
  /** Red when the load is more than the free time. */
  overloaded: boolean;
  /** Items without an estimate (they can't be counted). */
  unestimated: number;
};

/** RCCP-style capacity check for one day's scheduled items. */
export function dayCapacity(plan: DayPlan, dayItems: BacklogItem[]): DayCapacity {
  const items = dayItems.filter((i) => i.status !== "dropped");
  const blocks = new Set<BlockKey>([DEFAULT_BLOCK, ...items.map((i) => i.block ?? DEFAULT_BLOCK)]);
  const capacityMin = [...blocks].reduce((sum, k) => sum + freeMinutes(plan, k), 0);
  const loadMin = items.reduce((sum, i) => sum + (i.estimate_min ?? 0), 0);
  return {
    capacityMin,
    loadMin,
    overloaded: loadMin > capacityMin,
    unestimated: items.filter((i) => i.estimate_min === null).length,
  };
}

export type CarryPatch = Pick<BacklogItem, "scheduled_date" | "block" | "status" | "carry_count">;

/** Night ritual: move an unfinished item to another day (or back to the inbox with `null`). */
export function carryOver(item: BacklogItem, to: string | null): CarryPatch {
  if (to === null) {
    return { scheduled_date: null, block: null, status: "inbox", carry_count: item.carry_count + 1 };
  }
  return {
    scheduled_date: to,
    block: item.block ?? DEFAULT_BLOCK,
    status: "scheduled",
    carry_count: item.carry_count + 1,
  };
}
