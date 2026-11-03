"use client";

import { useLocale, useTranslations } from "next-intl";
import { ChevronIcon } from "@/components/ui/Icons";
import { addDays, isoWeekday } from "@/lib/time";

export type DayMarks = { appointment: boolean; tasks: boolean };

/** "2026-11" → first day, days in month. */
const monthInfo = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  const first = `${ym}-01`;
  return { first, days: new Date(Date.UTC(y, m, 0)).getUTCDate(), y, m };
};

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * A month at a glance (Mon-first): a warm dot = an appointment, a green dot = planned tasks.
 * Any month, any distance ahead. Tap a day to open it.
 */
export function MonthCalendar({
  month,
  today,
  selected,
  marks,
  onPick,
  onMonth,
}: {
  month: string;
  today: string;
  selected: string;
  marks: Record<string, DayMarks>;
  onPick: (date: string) => void;
  onMonth: (delta: number) => void;
}) {
  const t = useTranslations("plan");
  const locale = useLocale();
  const loc = locale === "th" ? "th-TH" : "en-GB";
  const { first, days, y, m } = monthInfo(month);
  const title = new Intl.DateTimeFormat(loc, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 15)),
  );
  const narrow = new Intl.DateTimeFormat(loc, { weekday: "narrow", timeZone: "UTC" });
  const letters = [1, 2, 3, 4, 5, 6, 7].map((d) => narrow.format(new Date(Date.UTC(2024, 0, d))));
  const lead = isoWeekday(first) - 1;
  const cells = Array.from({ length: days }, (_, i) => addDays(first, i));
  const full = new Intl.DateTimeFormat(loc, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label={t("prevMonth")}
          onClick={() => onMonth(-1)}
          className="tap flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-muted"
        >
          <ChevronIcon className="h-4 w-4 rotate-90" />
        </button>
        <h3 className="font-extrabold" aria-live="polite">
          {title}
        </h3>
        <button
          type="button"
          aria-label={t("nextMonth")}
          onClick={() => onMonth(1)}
          className="tap flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-muted"
        >
          <ChevronIcon className="h-4 w-4 -rotate-90" />
        </button>
      </div>
      <div aria-hidden="true" className="grid grid-cols-7 text-center text-xs font-bold text-muted">
        {letters.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
      <ol aria-label={title} className="grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => (
          <li key={`pad-${i}`} aria-hidden="true" />
        ))}
        {cells.map((d) => {
          const mk = marks[d];
          const past = d < today;
          const isSel = d === selected;
          const [yy, mm, dd] = d.split("-").map(Number);
          return (
            <li key={d}>
              <button
                type="button"
                aria-label={full.format(new Date(Date.UTC(yy, mm - 1, dd)))}
                aria-pressed={isSel}
                onClick={() => onPick(d)}
                className={`tap flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-xl text-sm font-bold tabular-nums ${
                  isSel ? "bg-primary-soft text-primary" : past ? "text-muted" : "text-ink"
                } ${d === today ? "ring-2 ring-primary ring-inset" : ""}`}
              >
                {dd}
                <span className="flex h-1.5 gap-0.5" aria-hidden="true">
                  {mk?.appointment && <span className="h-1.5 w-1.5 rounded-full bg-warn" />}
                  {mk?.tasks && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
