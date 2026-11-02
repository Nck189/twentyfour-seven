"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { BacklogList } from "@/components/backlog/BacklogList";
import { DayCard } from "@/components/backlog/DayCard";
import { ItemSheet } from "@/components/backlog/ItemSheet";
import { WeekStrip } from "@/components/backlog/WeekStrip";
import { Sheet } from "@/components/today/BlockSheet";
import { useBlockText } from "@/components/today/useBlockText";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { formatDayLong, formatWeekdayShort } from "@/lib/format";
import type { BlockKey } from "@/content/blocks";
import { dayCapacity } from "@/lib/backlog";
import { useBacklog } from "@/lib/backlog/useBacklog";
import { usePlan } from "@/lib/plan/usePlan";
import { addDays } from "@/lib/time";
import { planFor, templateFor } from "@/lib/today/day";
import { DayEditor } from "./DayEditor";
import { SaveStatus } from "./SaveStatus";

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
  // Stable ids for dnd-kit's screen-reader hints (no server/client mismatch).
  const dndId = useId();
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
    // Drop ids: "day:<date>" (strip), "card:<date>" (day card), "card:<date>:<block>" (wide screens).
    const [, date, block] = String(e.over.id).split(":");
    void backlog.schedule(String(e.active.id), date, block as BlockKey | undefined);
  }
  const item = backlog.items.find((i) => i.id === editingItem);
  const day = selected && days.includes(selected) ? selected : days[0];
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
      accessibility={{ announcements, screenReaderInstructions: { draggable: tb("a11y.instructions") } }}
      onDragStart={(e) => setDragging(String(e.active.id))}
      onDragCancel={() => setDragging(null)}
      onDragEnd={onDragEnd}
    >
      <ScreenHeader title={t("title")} />
      <SaveStatus state={plan.saving} />
      <WeekStrip days={stripDays} selected={day} onSelect={setSelected} label={t("week")} />
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
        onEdit={() => setEditing(day)}
        onOpen={setEditingItem}
        onComplete={backlog.complete}
      />

      <BacklogList
        items={backlog.items}
        today={plan.today}
        timezone={ctx.timezone}
        error={backlog.error}
        onAdd={backlog.add}
        onOpen={setEditingItem}
        onComplete={backlog.complete}
      />

      <DragOverlay>
        {dragging ? (
          <div className="rounded-xl bg-surface p-3 font-bold ring-2 ring-primary">{titleOf(dragging)}</div>
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
