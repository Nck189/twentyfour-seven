"use client";

import { useTranslations } from "next-intl";
import { formatTime } from "@/lib/format";
import type { Timeline as TimelineData, TimelineBlock } from "@/lib/today/day";
import type { BlockLog } from "@/lib/today/useToday";
import { useBlockText } from "./useBlockText";

export type BlockStatus = "upcoming" | "notStarted" | "inProgress" | "done" | "missed";

export function blockStatus(b: TimelineBlock, log: BlockLog, now: Date): BlockStatus {
  if (log.closed_at) return "done";
  if (log.started_at || log.first10_at || log.items_done.length) return "inProgress";
  if (now.getTime() >= b.end.getTime()) return "missed";
  if (now.getTime() >= b.start.getTime()) return "notStarted";
  return "upcoming";
}

const STATUS_STYLE: Record<BlockStatus, string> = {
  upcoming: "bg-surface-2 text-muted",
  notStarted: "bg-warn-soft text-warn",
  inProgress: "bg-primary-soft text-primary",
  done: "bg-primary text-on-primary",
  missed: "bg-accent-soft text-accent",
};

/** Vertical timeline of the 7 blocks (wake → next wake) with a "now" line in the current block. */
export function Timeline({
  timeline,
  logFor,
  now,
  timezone,
  currentKey,
  onOpen,
}: {
  timeline: TimelineData;
  logFor: (b: TimelineBlock) => BlockLog;
  now: Date;
  timezone: string;
  currentKey?: string;
  onOpen: (b: TimelineBlock) => void;
}) {
  const t = useTranslations("today");
  const text = useBlockText();
  return (
    <ol className="mx-4 mb-3 flex flex-col gap-2 lg:mx-6" aria-label={t("title")}>
      {timeline.blocks.map((b) => {
        const log = logFor(b);
        const status = blockStatus(b, log, now);
        const isCurrent = b.key === currentKey;
        const progress = isCurrent
          ? (now.getTime() - b.start.getTime()) / Math.max(1, b.end.getTime() - b.start.getTime())
          : 0;
        const events = timeline.fixedEvents.filter((e) => e.host === b.key);
        return (
          <li key={b.key} className="relative">
            <button
              type="button"
              onClick={() => onOpen(b)}
              aria-label={t("block.open", { block: text.name(b.key) })}
              aria-current={isCurrent ? "step" : undefined}
              className={`tap relative flex min-h-16 w-full items-center gap-3 overflow-hidden rounded-xl px-3 py-2 text-left ${
                isCurrent ? "bg-surface ring-2 ring-primary ring-inset" : "bg-surface"
              }`}
            >
              <span className="w-14 shrink-0 text-sm tabular-nums text-muted">
                {formatTime(b.start, timezone)}
                <br />
                {formatTime(b.end, timezone)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{text.name(b.key)}</span>
                {b.checklist.length > 0 && (
                  <span className="block text-xs text-muted">
                    {t("block.items", { done: log.items_done.length, total: b.checklist.length })}
                  </span>
                )}
                {events.map((e) => (
                  <span key={e.id} className="mt-0.5 block text-xs text-muted">
                    {t("block.fixedEvent")} {formatTime(e.start, timezone)}–{formatTime(e.end, timezone)}
                  </span>
                ))}
                {b.subSlots.map((s) => (
                  <span key={s.id} className="mt-0.5 block text-xs text-muted">
                    {formatTime(s.start, timezone)} {s.label}
                  </span>
                ))}
              </span>
              <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${STATUS_STYLE[status]}`}>
                {log.backfilled && status === "done" ? t("status.backfilled") : t(`status.${status}`)}
              </span>
              {isCurrent && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 h-0.5 bg-accent"
                  style={{ top: `${Math.min(100, Math.max(0, progress * 100))}%` }}
                />
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
