"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { MoonIcon, SunriseIcon, WarnIcon } from "@/components/ui/Icons";
import { DEFAULT_BLOCKS } from "@/content/blocks";
import { bedtimeFor, sleepMinutes } from "@/lib/onboarding";
import type { TemplateRow } from "@/lib/today/day";

const WEEK = [1, 2, 3, 4, 5, 6, 7];
const BASE_SLEEP = DEFAULT_BLOCKS.find((b) => b.key === "sleep")!.duration_min;

/** Narrow weekday letters in the app language (Mon-first), e.g. M T W … / จ อ พ … */
function useWeekLetters() {
  const locale = useLocale();
  const fmt = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    weekday: "narrow",
    timeZone: "UTC",
  });
  // 2024-01-01 is a Monday.
  return WEEK.map((d) => fmt.format(new Date(Date.UTC(2024, 0, d))));
}

/** One kind of day: which weekdays, bed → wake, and the night drawn as a bar. */
function DayKind({
  tpl,
  name,
  letters,
  onSleep,
  onMoveDay,
}: {
  tpl: TemplateRow;
  name: string;
  letters: string[];
  onSleep: (wake: string, sleepMin: number) => void;
  onMoveDay: (day: number) => void;
}) {
  const t = useTranslations("onboarding");
  const wake = tpl.target_wake.slice(0, 5);
  const sleepMin = tpl.blocks?.sleep?.duration_min ?? BASE_SLEEP;
  const [bed, setBed] = useState(bedtimeFor(wake, sleepMin));
  const [wakeDraft, setWakeDraft] = useState(wake);
  const minutes = sleepMinutes(bed, wakeDraft);
  const hours = minutes === null ? null : Math.round((minutes / 60) * 10) / 10;

  function commit(nextBed: string, nextWake: string) {
    const m = sleepMinutes(nextBed, nextWake);
    if (m !== null) onSleep(nextWake, m);
  }

  return (
    <li className="flex flex-col gap-3 rounded-[var(--radius-lg)] bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-extrabold">{name}</h3>
        <div role="group" aria-label={`${name} · ${t("weekdays")}`} className="flex gap-1">
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
      <div className="flex items-center gap-2">
        <label className="flex flex-1 items-center gap-2 rounded-xl bg-surface-2 px-3">
          <MoonIcon className="h-5 w-5 shrink-0 text-primary" />
          <span className="sr-only">{t("bed")}</span>
          <input
            type="time"
            value={bed}
            onChange={(e) => {
              setBed(e.target.value);
              commit(e.target.value, wakeDraft);
            }}
            className="min-h-11 w-full bg-transparent font-bold tabular-nums"
          />
        </label>
        <label className="flex flex-1 items-center gap-2 rounded-xl bg-surface-2 px-3">
          <SunriseIcon className="h-5 w-5 shrink-0 text-warn" />
          <span className="sr-only">{t("wake")}</span>
          <input
            type="time"
            value={wakeDraft}
            onChange={(e) => {
              setWakeDraft(e.target.value);
              commit(bed, e.target.value);
            }}
            className="min-h-11 w-full bg-transparent font-bold tabular-nums"
          />
        </label>
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

/** Sleep times for each kind of day, and which weekdays are which kind. */
export function SleepStep({
  templates,
  nameOf,
  onSleep,
  onMoveDay,
}: {
  templates: TemplateRow[];
  nameOf: (t: TemplateRow) => string;
  onSleep: (id: string, wake: string, sleepMin: number) => void;
  onMoveDay: (day: number, toId: string) => void;
}) {
  const t = useTranslations("onboarding");
  const letters = useWeekLetters();
  const kinds = templates.filter((x) => x.auto_apply);
  return (
    <section aria-labelledby="ob-sleep" className="flex flex-col gap-3">
      <div>
        <h2 id="ob-sleep" className="text-xl font-extrabold">
          {t("sleepTitle")}
        </h2>
        <p className="text-muted">{t("sleepHint")}</p>
      </div>
      <ul className="flex flex-col gap-3">
        {kinds.map((k) => (
          <DayKind
            key={k.id}
            tpl={k}
            name={nameOf(k)}
            letters={letters}
            onSleep={(wake, m) => onSleep(k.id, wake, m)}
            onMoveDay={(d) => onMoveDay(d, k.id)}
          />
        ))}
      </ul>
    </section>
  );
}
