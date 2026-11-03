"use client";

import { useDroppable } from "@dnd-kit/core";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useBlockText } from "@/components/today/useBlockText";
import { CalendarIcon } from "@/components/shell/TabIcons";
import { CloseIcon, MoonIcon, PencilIcon, SunriseIcon, WarnIcon } from "@/components/ui/Icons";
import type { FixedEvent } from "@/content/defaults";
import type { BlockKey } from "@/content/blocks";
import { dayCapacity, sortBacklog, type BacklogItem } from "@/lib/backlog";
import type { DayPlan } from "@/lib/engine";
import { formatTime } from "@/lib/format";
import { CapacityBar } from "./CapacityBar";
import { TaskRow } from "./BacklogList";

/** Blocks a task can be dropped onto directly on iPad/Mac. */
const DROP_BLOCKS: BlockKey[] = ["focus", "work", "gradation", "free"];

function BlockZone({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-11 flex-1 items-center justify-center rounded-lg text-sm font-bold ${
        isOver ? "bg-primary-soft text-primary" : "bg-surface-2 text-muted"
      }`}
    >
      {children}
    </div>
  );
}

/** The selected day at a glance: bed (the night before) → wake as icons, capacity, its tasks, and one edit button. */
export function DayCard({
  date,
  label,
  templateName,
  edited,
  plan,
  items,
  today,
  timezone,
  dragging,
  onEdit,
  onOpen,
  onComplete,
  appointments = [],
  onRemoveAppointment,
}: {
  date: string;
  label: string;
  templateName: string;
  edited: boolean;
  plan: DayPlan;
  items: BacklogItem[];
  today: string;
  timezone: string;
  dragging: boolean;
  onEdit: () => void;
  onOpen: (id: string) => void;
  onComplete: (id: string) => Promise<number | null>;
  /** One-off appointments on this day. */
  appointments?: FixedEvent[];
  onRemoveAppointment?: (id: string) => void;
}) {
  const t = useTranslations("plan");
  const text = useBlockText();
  const { setNodeRef, isOver } = useDroppable({ id: `card:${date}` });
  const dayItems = items.filter((i) => i.scheduled_date === date && i.status !== "dropped");
  // Done tasks stay in place, struck through (R-M5-2): no row jumps under the finger, the coin pop
  // plays, and a tap on a done task opens it ("Not done yet"). Near deadlines first (SPEC §5).
  const list = sortBacklog(dayItems, today);

  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      className={`mx-4 mb-5 flex flex-col gap-3 rounded-[var(--radius-lg)] bg-surface p-3 lg:mx-6 ${
        isOver ? "ring-2 ring-primary" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold">{label}</h2>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="font-bold">{templateName}</span>
            {edited && (
              <span className="rounded-full bg-primary-soft px-2 text-xs font-bold text-primary">
                {t("overridden")}
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          aria-label={t("edit", { day: label })}
          className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted"
        >
          <PencilIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm font-bold tabular-nums">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1">
          <MoonIcon className="h-4 w-4 text-primary" />
          <span className="sr-only">{t("bedLabel")} </span>
          {formatTime(plan.bedtime, timezone)}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1">
          <SunriseIcon className="h-4 w-4 text-warn" />
          <span className="sr-only">{t("wakeLabel")} </span>
          {formatTime(plan.wake, timezone)}
        </span>
        {plan.warnings.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-warn-soft px-2.5 py-1 text-warn">
            <WarnIcon className="h-4 w-4" />
            <span className="sr-only">{t("warnings", { count: plan.warnings.length })}</span>
            <span aria-hidden="true">{plan.warnings.length}</span>
          </span>
        )}
      </div>

      {appointments.length > 0 && (
        <ul aria-label={t("appointments")} className="flex flex-col gap-1.5">
          {appointments.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-xl bg-warn-soft py-1 pr-1 pl-3 text-warn"
            >
              <CalendarIcon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 font-bold [overflow-wrap:anywhere]">{a.title}</span>
              <span className="shrink-0 text-sm font-bold tabular-nums">{`${a.start}–${a.end}`}</span>
              {onRemoveAppointment && (
                <button
                  type="button"
                  aria-label={t("removeAppointment", { title: a.title ?? "" })}
                  onClick={() => onRemoveAppointment(a.id)}
                  className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {dayItems.length > 0 && <CapacityBar cap={dayCapacity(plan, dayItems)} />}

      {list.length > 0 && (
        <ul aria-label={t("dayTasks", { day: label })} className="flex flex-col gap-2">
          {list.map((i) => (
            <TaskRow
              key={i.id}
              item={i}
              today={today}
              timezone={timezone}
              onOpen={onOpen}
              onComplete={onComplete}
              inCard
            />
          ))}
        </ul>
      )}

      {dragging && (
        <div className="hidden gap-2 lg:flex">
          {DROP_BLOCKS.map((b) => (
            <BlockZone key={b} id={`card:${date}:${b}`}>
              {text.name(b)}
            </BlockZone>
          ))}
        </div>
      )}
    </section>
  );
}
