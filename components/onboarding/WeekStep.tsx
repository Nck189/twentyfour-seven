"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState, type ReactNode } from "react";
import {
  BriefcaseIcon,
  CapIcon,
  ChevronIcon,
  CloseIcon,
  MoonIcon,
  PlusIcon,
  SunriseIcon,
  UploadIcon,
  WarnIcon,
} from "@/components/ui/Icons";
import { DEFAULT_BLOCKS } from "@/content/blocks";
import type { FixedEvent } from "@/content/defaults";
import { bedtimeFor, sleepMinutes } from "@/lib/onboarding";
import type { TemplateRow } from "@/lib/today/day";

const WEEK = [1, 2, 3, 4, 5, 6, 7];
const BASE_SLEEP = DEFAULT_BLOCKS.find((b) => b.key === "sleep")!.duration_min;
/** One-tap sleep windows (bed → wake). */
const SLEEP_PRESETS: [string, string][] = [
  ["23:00", "07:00"],
  ["00:00", "08:00"],
  ["01:00", "09:00"],
  ["02:30", "10:00"],
];
const SLOT_KINDS = ["class", "work", "appointment"] as const;

/** Narrow weekday letters in the app language (Mon-first), e.g. M T W … / จ อ พ … */
function useWeekLetters() {
  const locale = useLocale();
  const fmt = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    weekday: "narrow",
    timeZone: "UTC",
  });
  return WEEK.map((d) => fmt.format(new Date(Date.UTC(2024, 0, d)))); // 2024-01-01 = Monday
}

function TimeField({
  label,
  value,
  onChange,
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  icon: ReactNode;
}) {
  return (
    <label className="flex flex-1 items-center gap-2 rounded-xl bg-surface-2 px-3">
      {icon}
      <span className="sr-only">{label}</span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full min-w-0 bg-transparent font-bold tabular-nums"
      />
    </label>
  );
}

/** Class/work slots as small chips; tap one to edit its time or remove it. */
function Slots({ events, onChange }: { events: FixedEvent[]; onChange: (e: FixedEvent[]) => void }) {
  const t = useTranslations("onboarding");
  const tf = useTranslations("fixedEvents");
  const [open, setOpen] = useState<string | null>(null);
  const label = (e: FixedEvent) =>
    e.title ?? (tf.has(e.key as Parameters<typeof tf>[0]) ? tf(e.key as Parameters<typeof tf>[0]) : e.key);
  const edit = (id: string, patch: Partial<FixedEvent>) =>
    onChange(events.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const editing = events.find((e) => e.id === open);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {events.map((e) => (
          <button
            key={e.id}
            type="button"
            aria-expanded={open === e.id}
            onClick={() => setOpen(open === e.id ? null : e.id)}
            className={`tap inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-bold ${
              open === e.id ? "bg-primary-soft text-primary ring-2 ring-primary ring-inset" : "bg-surface-2"
            }`}
          >
            {e.key === "work" ? <BriefcaseIcon className="h-4 w-4" /> : <CapIcon className="h-4 w-4" />}
            {label(e)} <span className="tabular-nums text-muted">{`${e.start}–${e.end}`}</span>
          </button>
        ))}
        <button
          type="button"
          aria-label={t("addSlot")}
          onClick={() => {
            const id = crypto.randomUUID();
            onChange([...events, { id, key: "class", title: null, start: "09:00", end: "12:00" }]);
            setOpen(id);
          }}
          className="tap inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-muted"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>
      {editing && (
        <div className="flex flex-col gap-2 rounded-xl bg-surface-2 p-2">
          <div role="radiogroup" aria-label={t("slotLabel")} className="flex gap-1.5">
            {SLOT_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={editing.key === k && !editing.title}
                onClick={() => edit(editing.id, { key: k, title: null })}
                className={`tap min-h-11 flex-1 rounded-full text-sm font-bold ${
                  editing.key === k && !editing.title ? "bg-primary-soft text-primary" : "bg-surface"
                }`}
              >
                {tf(k)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="time"
              aria-label={t("slotStart", { what: label(editing) })}
              value={editing.start}
              onChange={(e) => e.target.value && edit(editing.id, { start: e.target.value })}
              className="min-h-11 min-w-0 flex-1 rounded-xl bg-surface px-2 font-bold tabular-nums"
            />
            <span aria-hidden="true" className="text-muted">
              –
            </span>
            <input
              type="time"
              aria-label={t("slotEnd", { what: label(editing) })}
              value={editing.end}
              onChange={(e) => e.target.value && edit(editing.id, { end: e.target.value })}
              className="min-h-11 min-w-0 flex-1 rounded-xl bg-surface px-2 font-bold tabular-nums"
            />
            <button
              type="button"
              aria-label={t("removeSlot")}
              onClick={() => {
                onChange(events.filter((e) => e.id !== editing.id));
                setOpen(null);
              }}
              className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-muted"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** One kind of day: which weekdays, class/work slots, bed → wake, and the night as a bar. */
function DayKind({
  tpl,
  name,
  letters,
  onSleep,
  onMoveDay,
  onEvents,
}: {
  tpl: TemplateRow;
  name: string;
  letters: string[];
  onSleep: (wake: string, sleepMin: number) => void;
  onMoveDay: (day: number) => void;
  onEvents: (events: FixedEvent[]) => void;
}) {
  const t = useTranslations("onboarding");
  const wake0 = tpl.target_wake.slice(0, 5);
  const [bed, setBed] = useState(bedtimeFor(wake0, tpl.blocks?.sleep?.duration_min ?? BASE_SLEEP));
  const [wake, setWake] = useState(wake0);
  const minutes = sleepMinutes(bed, wake);
  const hours = minutes === null ? null : Math.round((minutes / 60) * 10) / 10;
  const commit = (b: string, w: string) => {
    const m = sleepMinutes(b, w);
    if (m !== null) onSleep(w, m);
  };

  return (
    <li className="flex flex-col gap-3 rounded-[var(--radius-lg)] bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-extrabold">{name}</h3>
        <div role="group" aria-label={`${name} · ${t("weekdays")}`} className="flex">
          {WEEK.map((d, i) => {
            const on = tpl.weekdays.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                aria-label={letters[i]}
                onClick={() => !on && onMoveDay(d)}
                className="tap flex h-11 w-8 items-center justify-center"
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    on ? "bg-primary text-on-primary" : "bg-surface-2 text-muted"
                  }`}
                >
                  {letters[i]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <Slots events={tpl.fixed_events} onChange={onEvents} />
      <div className="flex items-center gap-2">
        <TimeField
          label={t("bed")}
          value={bed}
          icon={<MoonIcon className="h-5 w-5 shrink-0 text-primary" />}
          onChange={(v) => {
            setBed(v);
            commit(v, wake);
          }}
        />
        <TimeField
          label={t("wake")}
          value={wake}
          icon={<SunriseIcon className="h-5 w-5 shrink-0 text-warn" />}
          onChange={(v) => {
            setWake(v);
            commit(bed, v);
          }}
        />
      </div>
      {/* The night as a bar: 12 h = full width; under 7 h turns warm. */}
      <div className="flex items-center gap-2">
        <div aria-hidden="true" className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
          {minutes !== null && (
            <div
              className={`h-full rounded-full ${minutes < 420 ? "bg-warn" : "bg-primary"}`}
              style={{ width: `${Math.min(100, (minutes / 720) * 100)}%` }}
            />
          )}
        </div>
        <span
          className={`text-sm font-bold tabular-nums ${minutes === null || minutes < 420 ? "text-warn" : "text-muted"}`}
        >
          {hours === null ? t("invalidSleep") : t("hours", { hours })}
        </span>
        {minutes !== null && minutes < 420 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-warn-soft px-2 py-0.5 text-xs font-bold text-warn">
            <WarnIcon className="h-3.5 w-3.5" />
            {t("shortSleep")}
          </span>
        )}
      </div>
    </li>
  );
}

/** One line per kind of day: name, weekday dots, slots, bed → wake. Tap to edit it alone. */
function KindSummary({
  tpl,
  name,
  letters,
  onOpen,
}: {
  tpl: TemplateRow;
  name: string;
  letters: string[];
  onOpen: () => void;
}) {
  const t = useTranslations("onboarding");
  const tf = useTranslations("fixedEvents");
  const wake = tpl.target_wake.slice(0, 5);
  const sleepMin = tpl.blocks?.sleep?.duration_min ?? BASE_SLEEP;
  const days = WEEK.filter((d) => tpl.weekdays.includes(d));
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="tap flex w-full items-center gap-2 rounded-[var(--radius-lg)] bg-surface p-3 text-left"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex items-center justify-between gap-2">
            <span className="font-extrabold">{name}</span>
            <span className="sr-only">{days.map((d) => letters[d - 1]).join(" ")}</span>
            <span aria-hidden="true" className="flex gap-1">
              {WEEK.map((d) => (
                <span
                  key={d}
                  className={`h-2 w-2 rounded-full ${tpl.weekdays.includes(d) ? "bg-primary" : "bg-surface-2"}`}
                />
              ))}
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-1.5 text-sm font-bold tabular-nums text-muted">
            {tpl.fixed_events.map((e) => (
              <span
                key={e.id}
                className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5"
              >
                {e.key === "work" ? (
                  <BriefcaseIcon className="h-3.5 w-3.5" />
                ) : (
                  <CapIcon className="h-3.5 w-3.5" />
                )}
                <span className="sr-only">
                  {e.title ??
                    (tf.has(e.key as Parameters<typeof tf>[0])
                      ? tf(e.key as Parameters<typeof tf>[0])
                      : e.key)}{" "}
                </span>
                {`${e.start}–${e.end}`}
              </span>
            ))}
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5">
              <MoonIcon className="h-3.5 w-3.5 text-primary" />
              <span className="sr-only">{t("bed")} </span>
              {bedtimeFor(wake, sleepMin)}
              <span aria-hidden="true">→</span>
              <SunriseIcon className="h-3.5 w-3.5 text-warn" />
              <span className="sr-only">{t("wake")} </span>
              {wake}
            </span>
          </span>
        </span>
        <ChevronIcon className="h-4 w-4 shrink-0 -rotate-90 text-muted" />
      </button>
    </li>
  );
}

/**
 * The week: each kind of day (weekdays, class/work slots, sleep). Shortcuts keep it quick:
 * one tap for the same sleep every day, add a kind of day, or import an .ics timetable.
 */
export function WeekStep({
  templates,
  version,
  nameOf,
  onSleep,
  onAllSleep,
  onMoveDay,
  onEvents,
  onAddKind,
  onImportIcs,
  onEditingChange,
}: {
  templates: TemplateRow[];
  version: number;
  nameOf: (t: TemplateRow) => string;
  onSleep: (id: string, wake: string, sleepMin: number) => void;
  onAllSleep: (wake: string, sleepMin: number) => void;
  onMoveDay: (day: number, toId: string) => void;
  onEvents: (id: string, events: FixedEvent[]) => void;
  onAddKind: () => void;
  onImportIcs: (text: string) => Promise<string>;
  /** Tells the parent when one kind is open on its own (it hides its Next button). */
  onEditingChange?: (editing: boolean) => void;
}) {
  const t = useTranslations("onboarding");
  const letters = useWeekLetters();
  const kinds = templates.filter((x) => x.auto_apply);
  const file = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);
  const [editing, setEditingState] = useState<string | null>(null);
  const setEditing = (id: string | null) => {
    setEditingState(id);
    onEditingChange?.(id !== null);
  };
  const open = kinds.find((k) => k.id === editing);

  // One kind of day on its own: nothing else on screen.
  if (open) {
    return (
      <section aria-label={nameOf(open)} className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setEditing(null)}
          className="tap flex min-h-11 items-center gap-1 self-start rounded-xl pr-2 text-sm font-bold text-primary"
        >
          <ChevronIcon className="h-4 w-4 rotate-90" />
          {t("backToWeek")}
        </button>
        <ul className="flex flex-col gap-3">
          <DayKind
            key={`${open.id}-${version}`}
            tpl={open}
            name={nameOf(open)}
            letters={letters}
            onSleep={(w, m) => onSleep(open.id, w, m)}
            onMoveDay={(d) => onMoveDay(d, open.id)}
            onEvents={(e) => onEvents(open.id, e)}
          />
        </ul>
        <button
          type="button"
          onClick={() => setEditing(null)}
          className="tap min-h-12 rounded-xl bg-primary px-4 font-bold text-on-primary"
        >
          {t("doneKind")}
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby="ob-sleep" className="flex flex-col gap-3">
      <div>
        <h2 id="ob-sleep" className="text-xl font-extrabold">
          {t("sleepTitle")}
        </h2>
        <p className="text-muted">{t("sleepHint")}</p>
      </div>

      <div role="group" aria-label={t("sameSleep")} className="flex flex-col gap-1.5">
        <span className="text-sm font-bold text-muted">{t("sameSleep")}</span>
        <div className="grid grid-cols-2 gap-1.5">
          {SLEEP_PRESETS.map(([b, w]) => (
            <button
              key={b}
              type="button"
              onClick={() => onAllSleep(w, sleepMinutes(b, w)!)}
              className="tap flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-surface text-sm font-bold tabular-nums"
            >
              <MoonIcon className="h-4 w-4 text-primary" />
              {b}
              <span aria-hidden="true" className="text-muted">
                –
              </span>
              <SunriseIcon className="h-4 w-4 text-warn" />
              {w}
            </button>
          ))}
        </div>
      </div>

      <ul aria-label={t("kinds")} className="flex flex-col gap-2">
        {kinds.map((k) => (
          <KindSummary
            key={k.id}
            tpl={k}
            name={nameOf(k)}
            letters={letters}
            onOpen={() => setEditing(k.id)}
          />
        ))}
      </ul>

      <button
        type="button"
        onClick={onAddKind}
        className="tap flex min-h-11 items-center justify-center gap-2 rounded-xl bg-surface font-bold text-muted"
      >
        <PlusIcon className="h-4 w-4" />
        {t("addKind")}
      </button>
      <button
        type="button"
        onClick={() => file.current?.click()}
        className="tap flex min-h-11 items-center justify-center gap-2 self-center rounded-xl px-3 text-sm font-bold text-primary"
      >
        <UploadIcon className="h-4 w-4" />
        {t("importIcs")}
      </button>
      <input
        ref={file}
        type="file"
        accept=".ics,text/calendar"
        aria-label={t("importIcs")}
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) setNote(await onImportIcs(await f.text()));
        }}
      />
      {note && (
        <p role="status" className="rounded-xl bg-primary-soft p-3 text-sm font-bold text-primary">
          {note}
        </p>
      )}
    </section>
  );
}
