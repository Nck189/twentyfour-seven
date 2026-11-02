"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { BacklogList } from "@/components/backlog/BacklogList";
import { CapacityBar } from "@/components/backlog/CapacityBar";
import { ItemSheet } from "@/components/backlog/ItemSheet";
import { Sheet } from "@/components/today/BlockSheet";
import { useBlockText } from "@/components/today/useBlockText";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { formatDayLong, formatTime } from "@/lib/format";
import type { BlockKey } from "@/content/blocks";
import { dayCapacity } from "@/lib/backlog";
import { useBacklog } from "@/lib/backlog/useBacklog";
import { usePlan } from "@/lib/plan/usePlan";
import { addDays } from "@/lib/time";
import { planFor, templateFor } from "@/lib/today/day";
import { DayEditor } from "./DayEditor";
import { SaveStatus } from "./SaveStatus";

/** Blocks a task can be dropped onto directly on iPad/Mac. */
const DROP_BLOCKS: BlockKey[] = ["focus", "work", "gradation", "free"];

/** A drop target: a whole day (→ its Work block) or, on wide screens, one block of a day. */
function Drop({ id, children, className }: { id: string; children: ReactNode; className: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`${className} ${isOver ? "ring-2 ring-primary" : ""}`}>
      {children}
    </div>
  );
}

/**
 * Week view (SPEC §4.1 / M4) + backlog week strip (SPEC §5 / M5): any future day can be planned
 * and overridden without touching templates; backlog items are dragged onto a day (or, on wide
 * screens, a block), with "Move to…" in the item sheet as the tap fallback.
 */
export function PlanScreen() {
  const t = useTranslations("plan");
  const tt = useTranslations("templates");
  const tc = useTranslations("common");
  const tb = useTranslations("backlog");
  const locale = useLocale();
  const text = useBlockText();
  const plan = usePlan();
  const backlog = useBacklog(plan.userId);
  const [editing, setEditing] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  if (plan.status === "loading" || !plan.ctx || !plan.today) {
    return (
      <>
        <ScreenHeader title={t("title")} />
        <p role="status" className="px-4 text-muted lg:px-6">
          {tc("loading")}
        </p>
      </>
    );
  }
  if (plan.status === "error") {
    return (
      <>
        <ScreenHeader title={t("title")} />
        <div
          role="alert"
          className="mx-4 flex flex-col items-start gap-3 rounded-[var(--radius-lg)] bg-accent-soft p-4 text-accent lg:mx-6"
        >
          <p>{t("loadError")}</p>
          <Button variant="secondary" onClick={plan.reload}>
            {tc("retry")}
          </Button>
        </div>
      </>
    );
  }

  const ctx = plan.ctx;
  const days = Array.from({ length: 7 }, (_, i) => addDays(plan.today!, i));
  const dayLabel = (d: string, i: number) =>
    i === 0 ? t("today") : i === 1 ? t("tomorrow") : formatDayLong(d, locale, ctx.timezone);
  const labelOf = (dropId: string) => {
    const [, date, block] = dropId.split(":");
    const day = dayLabel(date, days.indexOf(date));
    return block ? `${day} · ${text.name(block as BlockKey)}` : day;
  };
  const titleOf = (id: string | number) => backlog.items.find((i) => i.id === id)?.title ?? "";
  const announcements: Announcements = {
    onDragStart: ({ active }) => tb("a11y.start", { title: titleOf(active.id) }),
    onDragOver: ({ active, over }) =>
      over
        ? tb("a11y.over", { title: titleOf(active.id), target: labelOf(String(over.id)) })
        : tb("a11y.outside", { title: titleOf(active.id) }),
    onDragEnd: ({ active, over }) =>
      over
        ? tb("a11y.drop", { title: titleOf(active.id), target: labelOf(String(over.id)) })
        : tb("a11y.cancel", { title: titleOf(active.id) }),
    onDragCancel: ({ active }) => tb("a11y.cancel", { title: titleOf(active.id) }),
  };
  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    if (!e.over) return;
    const [, date, block] = String(e.over.id).split(":");
    void backlog.schedule(String(e.active.id), date, block as BlockKey | undefined);
  }
  const item = backlog.items.find((i) => i.id === editingItem);

  return (
    <DndContext
      sensors={sensors}
      accessibility={{ announcements, screenReaderInstructions: { draggable: tb("a11y.instructions") } }}
      onDragStart={(e) => setDragging(String(e.active.id))}
      onDragCancel={() => setDragging(null)}
      onDragEnd={onDragEnd}
    >
      <ScreenHeader title={t("title")} subtitle={t("week")} />
      <SaveStatus state={plan.saving} />
      <ol className="mx-4 mb-4 flex flex-col gap-2 lg:mx-6">
        {days.map((d, i) => {
          const p = planFor(ctx, d);
          const tpl = templateFor(ctx, d);
          const row = ctx.dayPlans[d];
          const edited = Boolean(
            row &&
            (row.template_id ||
              row.bedtime_override ||
              row.late_night ||
              row.attending === false ||
              Object.keys(row.overrides ?? {}).length),
          );
          const dayItems = backlog.items.filter((x) => x.scheduled_date === d && x.status !== "dropped");
          return (
            <li key={d}>
              <Drop id={`day:${d}`} className="flex flex-col gap-2 rounded-xl bg-surface">
                <button
                  type="button"
                  onClick={() => setEditing(d)}
                  aria-label={t("edit", { day: dayLabel(d, i) })}
                  className="tap flex min-h-16 w-full items-center gap-3 rounded-xl px-3 py-2 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{dayLabel(d, i)}</span>
                    <span className="block text-sm text-muted">
                      {tpl ? (tpl.name ?? tt(tpl.key as Parameters<typeof tt>[0])) : ""}
                      {edited && (
                        <span className="ml-2 rounded-full bg-primary-soft px-2 text-xs font-bold text-primary">
                          {t("overridden")}
                        </span>
                      )}
                      {dayItems.length > 0 && (
                        <span className="ml-2">{tb("dayItems", { count: dayItems.length })}</span>
                      )}
                    </span>
                  </span>
                  <span className="text-right text-sm tabular-nums text-muted">
                    {t("bed", { time: formatTime(p.bedtime, ctx.timezone) })}
                    <br />
                    {t("wake", { time: formatTime(p.wake, ctx.timezone) })}
                  </span>
                  {p.warnings.length > 0 && (
                    <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full bg-warn" />
                  )}
                </button>
                {dayItems.length > 0 && (
                  <div className="px-3 pb-2">
                    <CapacityBar cap={dayCapacity(p, dayItems)} />
                  </div>
                )}
                {dragging && (
                  <div className="hidden gap-2 px-3 pb-2 lg:flex">
                    {DROP_BLOCKS.map((b) => (
                      <Drop
                        key={b}
                        id={`day:${d}:${b}`}
                        className="flex min-h-11 flex-1 items-center justify-center rounded-lg bg-surface-2 text-sm font-bold text-muted"
                      >
                        {text.name(b)}
                      </Drop>
                    ))}
                  </div>
                )}
              </Drop>
            </li>
          );
        })}
      </ol>

      <BacklogList
        items={backlog.items}
        today={plan.today}
        timezone={ctx.timezone}
        error={backlog.error}
        onAdd={backlog.add}
        onOpen={setEditingItem}
      />

      <DragOverlay>
        {dragging ? (
          <div className="rounded-xl bg-surface p-3 font-bold shadow-none ring-2 ring-primary">
            {titleOf(dragging)}
          </div>
        ) : null}
      </DragOverlay>

      {editing && (
        <Sheet
          title={t("edit", { day: dayLabel(editing, days.indexOf(editing)) })}
          onClose={() => {
            void plan.flush();
            setEditing(null);
          }}
        >
          <DayEditor
            ctx={ctx}
            date={editing}
            onChange={plan.updateDay}
            onSaveDefault={plan.saveBlockDefault}
          />
        </Sheet>
      )}

      {item && (
        <Sheet title={item.title} onClose={() => setEditingItem(null)}>
          <ItemSheet
            key={item.id}
            item={item}
            days={days.map((d, i) => ({ date: d, label: dayLabel(d, i) }))}
            onUpdate={(patch) => void backlog.update(item.id, patch)}
            onSchedule={(date, block) => void backlog.schedule(item.id, date, block)}
            onComplete={() => backlog.complete(item.id)}
            onReopen={() => void backlog.reopen(item.id)}
            onRemove={() => {
              void backlog.drop(item.id);
              setEditingItem(null);
            }}
          />
        </Sheet>
      )}
    </DndContext>
  );
}
