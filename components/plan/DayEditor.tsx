"use client";

import type { SubSlot } from "@/lib/engine/types";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { BLOCK_KEYS, type BlockKey, type ChecklistItem } from "@/content/blocks";
import { useBlockText } from "@/components/today/useBlockText";
import { Button } from "@/components/ui/Button";
import { CloseIcon, StepsIcon } from "@/components/ui/Icons";
import { Segmented } from "@/components/ui/Segmented";
import { parseHHMM, targetBedtime } from "@/lib/engine";
import { formatDayLong, formatTime } from "@/lib/format";
import type { DayPatch } from "@/lib/plan/usePlan";
import { addDays, zonedInstant } from "@/lib/time";
import { planFor, templateFor, type DayContext } from "@/lib/today/day";

const STEP_MIN = 15;

function newId() {
  return `i${Math.random().toString(36).slice(2, 9)}`;
}

/** A planned workout in a block (SPEC §6 "floating item"); the engine warns if a gym slot ends after the gym closes. */
function WorkoutSlot({ slots, onChange }: { slots: SubSlot[]; onChange: (slots: SubSlot[]) => void }) {
  const te = useTranslations("exercise");
  const workout = slots.find((s) => s.kind === "gym");
  if (workout)
    return (
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-sm font-bold">
          {te("slotLabel", { n: workout.durationMin })}
        </span>
        <Button variant="ghost" onClick={() => onChange(slots.filter((s) => s.id !== workout.id))}>
          {te("planRemove")}
        </Button>
      </div>
    );
  return (
    <div>
      <p className="mb-1 text-sm font-bold">{te("plan")}</p>
      <div className="flex flex-wrap gap-2">
        {[30, 45, 60, 90].map((m) => (
          <button
            key={m}
            type="button"
            aria-label={`${te("planAdd")} · ${te("minutesValue", { n: m })}`}
            onClick={() =>
              onChange([...slots, { id: newId(), label: "", kind: "gym", offsetMin: 0, durationMin: m }])
            }
            className="tap min-h-11 rounded-xl bg-surface px-3 text-sm font-bold"
          >
            {te("minutesValue", { n: m })}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Edits one day (D): template, attending, the bedtime the night before D, late night, block checklists. */
export function DayEditor({
  ctx,
  date,
  today,
  onChange,
  onSaveDefault,
}: {
  ctx: DayContext;
  date: string;
  /** The current wake-day: decides "tonight" vs "the night before {day}", and past nights. */
  today: string;
  onChange: (date: string, patch: DayPatch) => void;
  onSaveDefault: (
    key: BlockKey,
    patch: { checklist?: ChecklistItem[]; first10?: string | null },
  ) => Promise<void>;
}) {
  const t = useTranslations("plan");
  const tt = useTranslations("templates");
  const tw = useTranslations("today.warnings");
  const text = useBlockText();
  const ids = useId();
  const tz = ctx.timezone;
  const row = ctx.dayPlans[date];
  const tpl = templateFor(ctx, date);
  const plan = planFor(ctx, date);
  const sleepMin = ctx.blocks.find((b) => b.key === "sleep")!.duration_min;
  const locale = useLocale();
  const tonight = date === addDays(today, 1);
  const nightPassed = date <= today;
  const dayName = formatDayLong(date, locale, ctx.timezone);
  const [openBlock, setOpenBlock] = useState<BlockKey | null>(null);
  const [draft, setDraft] = useState("");
  const [savedDefault, setSavedDefault] = useState<BlockKey | null>(null);

  const target = tpl
    ? targetBedtime(
        date,
        tpl.options.attend_toggle && row?.attending === false && tpl.options.alt_target_wake
          ? tpl.options.alt_target_wake
          : tpl.target_wake,
        sleepMin,
        tz,
      )
    : plan.bedtime;
  const bedtime = row?.bedtime_override ? new Date(row.bedtime_override) : target;
  const shiftBedtime = (deltaMin: number) =>
    onChange(date, { bedtime_override: new Date(bedtime.getTime() + deltaMin * 60_000).toISOString() });

  const lateReturn = row?.late_night?.return_at ? new Date(row.late_night.return_at) : null;
  const setLateReturn = (hhmm: string) => {
    if (!hhmm) return onChange(date, { late_night: null });
    const m = parseHHMM(hhmm);
    // Before noon = after midnight (on D); otherwise the evening before D.
    const day = m < 12 * 60 ? date : addDays(date, -1);
    onChange(date, { late_night: { return_at: zonedInstant(day, m, tz).toISOString() } });
  };

  const blockMeta = (key: BlockKey) => {
    const base = ctx.blocks.find((b) => b.key === key)!;
    const o = row?.overrides.blocks?.[key];
    return {
      subSlots: o?.sub_slots ?? [],
      checklist: o?.checklist ?? tpl?.blocks?.[key]?.checklist ?? base.checklist,
      first10: o?.first10 !== undefined ? o.first10 : (tpl?.blocks?.[key]?.first10 ?? base.first10),
    };
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Template */}
      <section aria-labelledby={`${ids}-tpl`}>
        <h3 id={`${ids}-tpl`} className="mb-2 font-bold">
          {t("template")}
        </h3>
        <div role="radiogroup" aria-labelledby={`${ids}-tpl`} className="grid grid-cols-2 gap-2">
          {ctx.templates.map((x) => (
            <button
              key={x.id}
              type="button"
              role="radio"
              aria-checked={tpl?.id === x.id}
              onClick={() => onChange(date, { template_id: x.id })}
              className={`tap min-h-11 rounded-xl px-3 py-2 text-left text-sm font-bold ${
                tpl?.id === x.id
                  ? "bg-primary-soft text-primary ring-2 ring-primary ring-inset"
                  : "bg-surface-2 text-ink"
              }`}
            >
              {x.name ?? tt(x.key as Parameters<typeof tt>[0])}
              <span className="block text-xs font-normal text-muted">{x.target_wake.slice(0, 5)}</span>
            </button>
          ))}
        </div>
        {tpl?.options.attend_toggle && (
          <div className="mt-3">
            <p className="mb-1 text-sm font-bold">
              {tonight ? t("attending") : t("attendingOn", { day: dayName })}
            </p>
            <Segmented<"going" | "skipping">
              label={tonight ? t("attending") : t("attendingOn", { day: dayName })}
              value={row?.attending === false ? "skipping" : "going"}
              onChange={(v) => onChange(date, { attending: v === "going" })}
              options={[
                { value: "going", label: t("going") },
                { value: "skipping", label: t("skipping") },
              ]}
            />
          </div>
        )}
      </section>

      {/* Bedtime: the night before `date`. For today it's over: not editable (R-M4-7). */}
      {!nightPassed && (
        <section aria-labelledby={`${ids}-bed`}>
          <h3 id={`${ids}-bed`} className="mb-1 font-bold">
            {tonight ? t("bedtime") : t("bedtimeBefore", { day: dayName })}
          </h3>
          <div className="flex items-center gap-2">
            <Button variant="secondary" aria-label={t("earlier")} onClick={() => shiftBedtime(-STEP_MIN)}>
              −15
            </Button>
            <output aria-live="polite" className="min-w-20 text-center text-2xl font-extrabold tabular-nums">
              {formatTime(plan.bedtime, tz)}
            </output>
            <Button variant="secondary" aria-label={t("later")} onClick={() => shiftBedtime(STEP_MIN)}>
              +15
            </Button>
            {row?.bedtime_override && (
              <Button variant="ghost" onClick={() => onChange(date, { bedtime_override: null })}>
                {t("reset")}
              </Button>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            {t("bedtimeTarget", { time: formatTime(target, tz) })}
            {plan.pushMin > 0 && ` · ${t("pushNote", { minutes: plan.pushMin })}`}
          </p>
        </section>
      )}

      {/* Late night */}
      {!nightPassed && (
        <section aria-labelledby={`${ids}-late`}>
          <h3 id={`${ids}-late`} className="mb-1 font-bold">
            {tonight ? t("lateNight") : t("lateNightBefore", { day: dayName })}
          </h3>
          <p className="mb-2 text-sm text-muted">{t("lateNightHint")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={`${ids}-ret`} className="text-sm font-bold">
              {t("returnAt")}
            </label>
            <input
              id={`${ids}-ret`}
              type="time"
              value={lateReturn ? formatTime(lateReturn, tz) : ""}
              onChange={(e) => setLateReturn(e.target.value)}
              className="min-h-11 rounded-xl border border-line bg-surface px-3"
            />
            {lateReturn && (
              <Button variant="ghost" onClick={() => setLateReturn("")}>
                {t("lateNightOff")}
              </Button>
            )}
          </div>
        </section>
      )}

      {/* Live preview + warnings */}
      <section aria-labelledby={`${ids}-prev`}>
        <h3 id={`${ids}-prev`} className="mb-2 font-bold">
          {t("preview")}
        </h3>
        {plan.warnings.length > 0 && (
          <ul className="mb-2 flex flex-col gap-1">
            {plan.warnings.map((w, i) => (
              <li
                key={i}
                role="alert"
                className="rounded-xl bg-warn-soft px-3 py-2 text-sm font-bold text-warn"
              >
                {w.type === "short_sleep"
                  ? tw("short_sleep", { hours: Math.round((w.sleepMin / 60) * 10) / 10 })
                  : w.type === "bedtime_drift"
                    ? tw("bedtime_drift", { minutes: Math.abs(w.deltaMin) })
                    : tw(w.type)}
              </li>
            ))}
          </ul>
        )}
        <ol
          className="grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1 rounded-xl bg-surface-2 p-3 text-sm"
          aria-label={t("preview")}
        >
          {plan.blocks.map((b) => (
            <li key={b.key} className="contents">
              <span className="tabular-nums text-muted">{formatTime(b.start, tz)}</span>
              <span className="font-bold">{text.name(b.key)}</span>
              <span className="tabular-nums text-muted">{Math.round((b.durationMin / 60) * 10) / 10}h</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Per-block first-10 + checklist (this day only, or saved as default) */}
      <section aria-labelledby={`${ids}-blocks`}>
        <h3 id={`${ids}-blocks`} className="mb-2 font-bold">
          {t("blocks")}
        </h3>
        <div className="flex flex-col gap-2">
          {BLOCK_KEYS.map((key) => {
            const meta = blockMeta(key);
            const isOpen = openBlock === key;
            return (
              <div key={key} className="rounded-xl bg-surface-2">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenBlock(isOpen ? null : key)}
                  className="tap flex min-h-12 w-full items-center justify-between px-3 text-left font-bold"
                >
                  <span>{text.name(key)}</span>
                  {meta.checklist.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-muted">
                      <StepsIcon className="h-3.5 w-3.5" />
                      {meta.checklist.length}
                    </span>
                  )}
                </button>
                {isOpen && (
                  <div className="flex flex-col gap-2 px-3 pb-3">
                    <WorkoutSlot
                      slots={meta.subSlots}
                      onChange={(sub_slots) => onChange(date, { block: { key, sub_slots } })}
                    />
                    <label htmlFor={`${ids}-${key}-f10`} className="text-sm font-bold">
                      {t("first10")}
                    </label>
                    <input
                      id={`${ids}-${key}-f10`}
                      value={meta.first10 ?? ""}
                      placeholder={text.first10(key, null) ?? t("first10Placeholder")}
                      onChange={(e) => onChange(date, { block: { key, first10: e.target.value || null } })}
                      className="min-h-11 rounded-xl border border-line bg-surface px-3"
                    />
                    <p className="text-sm font-bold">{t("checklist")}</p>
                    <ul className="flex flex-col gap-1">
                      {meta.checklist.map((item) => (
                        <li key={item.id} className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 break-words">{item.label}</span>
                          <Button
                            variant="ghost"
                            aria-label={t("remove", { item: item.label })}
                            onClick={() =>
                              onChange(date, {
                                block: { key, checklist: meta.checklist.filter((x) => x.id !== item.id) },
                              })
                            }
                          >
                            <CloseIcon className="h-4 w-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const label = draft.trim();
                        if (!label) return;
                        onChange(date, {
                          block: { key, checklist: [...meta.checklist, { id: newId(), label }] },
                        });
                        setDraft("");
                      }}
                    >
                      <input
                        aria-label={t("addItemPlaceholder")}
                        value={draft}
                        maxLength={200}
                        placeholder={t("addItemPlaceholder")}
                        onChange={(e) => setDraft(e.target.value)}
                        className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3"
                      />
                      <Button type="submit" variant="secondary">
                        {t("addItem")}
                      </Button>
                    </form>
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        await onSaveDefault(key, { checklist: meta.checklist, first10: meta.first10 });
                        setSavedDefault(key);
                      }}
                    >
                      {savedDefault === key ? t("savedDefault") : t("saveDefault", { block: text.name(key) })}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
