"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { BacklogList } from "@/components/backlog/BacklogList";
import { DayCard } from "@/components/backlog/DayCard";
import { ItemSheet } from "@/components/backlog/ItemSheet";
import { MonthCalendar, shiftMonth, type DayMarks } from "@/components/backlog/MonthCalendar";
import { WeekStrip } from "@/components/backlog/WeekStrip";
import { CalendarIcon } from "@/components/shell/TabIcons";
import { Sheet } from "@/components/today/BlockSheet";
import { useBlockText } from "@/components/today/useBlockText";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { formatDayLong, formatDayShort, formatWeekdayShort } from "@/lib/format";
import type { BlockKey } from "@/content/blocks";
import { dayCapacity } from "@/lib/backlog";
import { useBacklog } from "@/lib/backlog/useBacklog";
import { usePlan } from "@/lib/plan/usePlan";
import { addDays } from "@/lib/time";
import { planFor, templateFor } from "@/lib/today/day";
import { DayEditor } from "./DayEditor";
import { SaveStatus } from "./SaveStatus";

/**
 * Drop where the finger/pointer is (the dragged chip can be wide and overlap the big day card);
 * keyboard drags have no pointer, so they fall back to rectangle overlap.
 */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

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
  const [selected, setSelected] = useState<string | null>(null);
  const [monthOpen, setMonthOpen] = useState(false);
  const [month, setMonth] = useState<string | null>(null);
  // Stable ids for dnd-kit's screen-reader hints (no server/client mismatch).
  const dndId = useId();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

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
    // Drop ids: "day:<date>" (strip), "card:<date>" (day card), "card:<date>:<block>" (wide screens).
    const [, date, block] = String(e.over.id).split(":");
    void backlog.schedule(String(e.active.id), date, block as BlockKey | undefined);
  }
  const item = backlog.items.find((i) => i.id === editingItem);
  // Any date can be selected (the month view reaches months ahead); default today.
  const day = selected ?? days[0];
  const nextAppt = plan.appointments[0];
  const marks: Record<string, DayMarks> = {};
  for (const a of plan.appointments)
    marks[a.date] = { appointment: true, tasks: marks[a.date]?.tasks ?? false };
  for (const i of backlog.items)
    if (i.scheduled_date && i.status === "scheduled")
      marks[i.scheduled_date] = { appointment: marks[i.scheduled_date]?.appointment ?? false, tasks: true };
  const shownMonth = month ?? day.slice(0, 7);
  const dayIndex = days.indexOf(day);
  const tplOf = (d: string) => {
    const tpl = templateFor(ctx, d);
    return tpl ? (tpl.name ?? tt(tpl.key as Parameters<typeof tt>[0])) : "";
  };
  const editedOn = (d: string) => {
    const row = ctx.dayPlans[d];
    return Boolean(
      row &&
      (row.template_id ||
        row.bedtime_override ||
        row.late_night ||
        row.attending === false ||
        Object.keys(row.overrides ?? {}).length),
    );
  };
  const stripDays = days.map((d, i) => {
    const p = planFor(ctx, d);
    const dayItems = backlog.items.filter((x) => x.scheduled_date === d && x.status !== "dropped");
    return {
      date: d,
      label: dayLabel(d, i),
      weekday: formatWeekdayShort(d, locale, ctx.timezone),
      num: Number(d.slice(8)),
      cap: dayItems.length ? dayCapacity(p, dayItems) : null,
      warn: p.warnings.length > 0,
    };
  });

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={collision}
      accessibility={{ announcements, screenReaderInstructions: { draggable: tb("a11y.instructions") } }}
      onDragStart={(e) => setDragging(String(e.active.id))}
      onDragCancel={() => setDragging(null)}
      onDragEnd={onDragEnd}
    >
      <ScreenHeader
        title={t("title")}
        action={
          <button
            type="button"
            aria-label={t("month")}
            onClick={() => {
              setMonth(null);
              setMonthOpen(true);
            }}
            className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-primary"
          >
            <CalendarIcon className="h-5 w-5" />
          </button>
        }
      />
      <SaveStatus state={plan.saving} />
      <WeekStrip days={stripDays} selected={day} onSelect={setSelected} label={t("week")} />
      {nextAppt && (
        <button
          type="button"
          onClick={() => setSelected(nextAppt.date)}
          className="tap mx-4 mb-3 flex min-h-11 items-center gap-2 rounded-xl bg-warn-soft px-3 text-left text-sm font-bold text-warn lg:mx-6"
        >
          <CalendarIcon className="h-4 w-4 shrink-0" />
          <span className="sr-only">{t("nextAppointment")} </span>
          <span className="min-w-0 flex-1 truncate">{nextAppt.title}</span>
          <span className="shrink-0 tabular-nums">
            {formatDayShort(nextAppt.date, locale, ctx.timezone)} · {nextAppt.start}
          </span>
        </button>
      )}
      <DayCard
        date={day}
        label={dayLabel(day, dayIndex)}
        templateName={tplOf(day)}
        edited={editedOn(day)}
        plan={planFor(ctx, day)}
        items={backlog.items}
        today={plan.today}
        timezone={ctx.timezone}
        dragging={dragging !== null}
        appointments={(ctx.dayPlans[day]?.overrides.fixed_events ?? []).filter(
          (e) => e.key === "appointment",
        )}
        onRemoveAppointment={(id) => void plan.removeAppointment(day, id)}
        onEdit={() => setEditing(day)}
        onOpen={setEditingItem}
        onComplete={backlog.complete}
      />

      <BacklogList
        items={backlog.items}
        today={plan.today}
        timezone={ctx.timezone}
        error={backlog.error}
        loadState={backlog.status}
        onRetry={backlog.reload}
        onAdd={async (c) => {
          if (c.appointment) {
            await plan.addAppointment(c.appointment.date, c.title, c.appointment.start, c.appointment.end);
            setSelected(c.appointment.date);
            return true;
          }
          return backlog.add(c);
        }}
        onOpen={setEditingItem}
        onComplete={backlog.complete}
      />

      <DragOverlay>
        {dragging ? (
          <div className="rounded-xl bg-surface p-3 font-bold ring-2 ring-primary">{titleOf(dragging)}</div>
        ) : null}
      </DragOverlay>

      {monthOpen && (
        <Sheet title={t("month")} onClose={() => setMonthOpen(false)}>
          <MonthCalendar
            month={shownMonth}
            today={plan.today}
            selected={day}
            marks={marks}
            onMonth={(d) => setMonth(shiftMonth(shownMonth, d))}
            onPick={(d) => {
              setSelected(d);
              setMonthOpen(false);
            }}
          />
        </Sheet>
      )}

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
            days={stripDays.map((d) => ({ date: d.date, label: d.label, weekday: d.weekday, num: d.num }))}
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
