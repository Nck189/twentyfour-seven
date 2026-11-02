"use client";

import { useDroppable } from "@dnd-kit/core";
import type { DayCapacity } from "@/lib/backlog";

export type StripDay = {
  date: string;
  /** Full name for screen readers / tests, e.g. "Tomorrow". */
  label: string;
  /** e.g. "Wed" / "พ." */
  weekday: string;
  /** Day of month. */
  num: number;
  cap: DayCapacity | null;
  warn: boolean;
};

const R = 15;
const C = 2 * Math.PI * R;

/** Capacity as a ring around the date: fill = planned / free; full warm ring when over. */
function Ring({ cap }: { cap: DayCapacity | null }) {
  const ratio = !cap || cap.capacityMin === 0 ? (cap?.loadMin ? 1 : 0) : cap.loadMin / cap.capacityMin;
  const shown = Math.min(1, ratio);
  return (
    <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
      <circle cx="18" cy="18" r={R} fill="none" stroke="var(--ui-surface-2)" strokeWidth="3.5" />
      {shown > 0 && (
        <circle
          cx="18"
          cy="18"
          r={R}
          fill="none"
          stroke={cap?.overloaded ? "var(--ui-warn)" : "var(--ui-primary)"}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={`${shown * C} ${C}`}
        />
      )}
    </svg>
  );
}

function Chip({ day, selected, onSelect }: { day: StripDay; selected: boolean; onSelect: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day.date}` });
  return (
    <li ref={setNodeRef} className="min-w-0">
      <button
        type="button"
        aria-pressed={selected}
        aria-label={day.label}
        onClick={onSelect}
        className={`tap relative flex min-h-[4.25rem] w-full flex-col items-center gap-1 rounded-2xl py-1.5 ${
          selected ? "bg-primary-soft text-primary" : "text-muted"
        } ${isOver ? "ring-2 ring-primary" : ""}`}
      >
        <span className="text-[0.7rem] font-bold leading-none">{day.weekday}</span>
        <span className="relative flex h-9 w-9 items-center justify-center">
          <Ring cap={day.cap} />
          <span className={`text-sm font-extrabold tabular-nums ${selected ? "text-primary" : "text-ink"}`}>
            {day.num}
          </span>
        </span>
        {day.warn && (
          <span aria-hidden="true" className="absolute top-1 right-1.5 h-2 w-2 rounded-full bg-warn" />
        )}
      </button>
    </li>
  );
}

/** Mon–Sun strip of the next 7 days; each day is also a drop target for backlog tasks. */
export function WeekStrip({
  days,
  selected,
  onSelect,
  label,
}: {
  days: StripDay[];
  selected: string;
  onSelect: (date: string) => void;
  label: string;
}) {
  return (
    <ol aria-label={label} className="mx-4 mb-3 grid grid-cols-7 gap-1 lg:mx-6">
      {days.map((d) => (
        <Chip key={d.date} day={d} selected={d.date === selected} onSelect={() => onSelect(d.date)} />
      ))}
    </ol>
  );
}
