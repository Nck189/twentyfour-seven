"use client";

import { useId, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatDayShort } from "@/lib/format";
import { parseQuickAdd } from "@/lib/plan/quickAdd";

const plusHour = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return `${String(Math.min(23, h! + 1)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

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
  const parsed = text.trim() ? parseQuickAdd(text, today, defaultDate) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!parsed) return;
    setBusy(true);
    setMsg(null);
    const title = parsed.title || t("untitled");
    try {
      await onAdd(parsed.date, title, parsed.start, parsed.end ?? plusHour(parsed.start));
      setMsg({
        ok: true,
        text: t("added", {
          title,
          day: formatDayShort(parsed.date, locale, timezone),
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
                day: formatDayShort(parsed.date, locale, timezone),
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
