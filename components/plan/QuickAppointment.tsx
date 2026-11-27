"use client";

import { useId, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatDayShort } from "@/lib/format";
import { endAfter, parseQuickAddDetail, type QuickAdd } from "@/lib/plan/quickAdd";
import { addDays, localParts } from "@/lib/time";

/**
 * What to save: with no date written and the default being today, a time already gone today means
 * tomorrow ("ตี 1" typed in the morning, G7 G S3).
 */
function read(text: string, today: string, defaultDate: string, timezone: string): QuickAdd | null {
  const q = parseQuickAddDetail(text, today, defaultDate);
  if (!q) return null;
  const { dateGiven, ...rest } = q;
  if (!dateGiven && rest.date === today) {
    const now = localParts(new Date(), timezone);
    const nowHm = `${String(now.hour).padStart(2, "0")}:${String(now.minute).padStart(2, "0")}`;
    if (rest.start < nowHm) return { ...rest, date: addDays(today, 1) };
  }
  return rest;
}

/**
 * G2 (Minnie OK 2026-11-27): an appointment in one line, the moment it comes up ("บ่าย 2 หมอฟัน",
 * "Fri 3pm dentist"). A live preview shows the day and time it read, so a wrong guess is visible
 * before saving. With no date, `defaultDate` is meant (tomorrow in the Night ritual, today in the
 * morning check).
 */
export function QuickAppointment({
  today,
  defaultDate,
  timezone,
  onAdd,
}: {
  today: string;
  defaultDate: string;
  timezone: string;
  onAdd: (date: string, title: string, start: string, end: string) => Promise<void>;
}) {
  const t = useTranslations("quickAppt");
  const locale = useLocale();
  const field = useId();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const parsed = text.trim() ? read(text, today, defaultDate, timezone) : null;
  // A date in another year shows its year, so "26/11" read as next year is visible (G7 G S3).
  const dayLabel = (d: string) =>
    d.slice(0, 4) === today.slice(0, 4)
      ? formatDayShort(d, locale, timezone)
      : `${formatDayShort(d, locale, timezone)} ${d.slice(0, 4)}`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!parsed) return;
    setBusy(true);
    setMsg(null);
    const title = parsed.title || t("untitled");
    try {
      await onAdd(parsed.date, title, parsed.start, parsed.end ?? endAfter(parsed.start));
      setMsg({
        ok: true,
        text: t("added", {
          title,
          day: dayLabel(parsed.date),
          time: parsed.start,
        }),
      });
      setText("");
    } catch {
      setMsg({ ok: false, text: t("failed") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-2">
      <label htmlFor={field} className="text-sm font-bold">
        {t("label")}
      </label>
      <div className="flex gap-2">
        <input
          id={field}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setMsg(null);
          }}
          placeholder={t("placeholder")}
          autoComplete="off"
          className="min-h-11 min-w-0 flex-1 rounded-xl bg-surface-2 px-3"
        />
        <button
          type="submit"
          disabled={!parsed || busy}
          className="tap min-h-11 rounded-full bg-primary px-4 font-bold text-on-primary disabled:opacity-50"
        >
          {t("add")}
        </button>
      </div>
      {text.trim() && (
        <p className="text-sm text-muted" aria-live="polite">
          {parsed
            ? t("preview", {
                day: dayLabel(parsed.date),
                time: parsed.end ? `${parsed.start}–${parsed.end}` : parsed.start,
                title: parsed.title || t("untitled"),
              })
            : t("needTime")}
        </p>
      )}
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className="text-sm font-bold">
          {msg.text}
        </p>
      )}
    </form>
  );
}
