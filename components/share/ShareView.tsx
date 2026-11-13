"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { getSupabase } from "@/lib/supabase/client";

type Day = { date: string; free: { start: string; end: string }[] };

const STEP_MIN = 30;
const LENGTHS = [30, 60, 90, 120];

/** The public free-times page (M12): pick a free time, leave a name and a note, send. */
export function ShareView({
  token,
  name,
  timezone,
  days,
}: {
  token: string;
  name: string | null;
  timezone: string;
  days: Day[];
}) {
  const t = useTranslations("share");
  const locale = useLocale();
  const [open, setOpen] = useState<{ date: string; start: string; end: string } | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const time = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    [locale, timezone],
  );
  const dayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }),
    [locale],
  );
  const anyFree = days.some((d) => d.free.length > 0);
  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <h1 className="text-2xl font-extrabold">{name ? t("titleName", { name }) : t("title")}</h1>
      <p className="mb-4 text-sm text-muted">{t("subtitle", { tz: timezone })}</p>
      {sent && (
        <p role="status" className="mb-4 rounded-xl bg-primary-soft p-3 font-bold text-primary">
          {t("sent", { time: sent })}
        </p>
      )}
      {!anyFree && <p className="rounded-xl bg-surface p-4 text-muted">{t("none")}</p>}
      <ul className="flex flex-col gap-3">
        {days
          .filter((d) => d.free.length > 0)
          .map((d) => (
            <li key={d.date} className="rounded-[var(--radius-lg)] bg-surface p-3">
              <h2 className="mb-2 font-bold">{dayLabel.format(new Date(`${d.date}T00:00:00Z`))}</h2>
              <div className="flex flex-wrap gap-2">
                {d.free.map((i) => (
                  <button
                    key={i.start}
                    type="button"
                    onClick={() => {
                      setSent(null);
                      setOpen({ date: d.date, start: i.start, end: i.end });
                    }}
                    aria-label={t("pick", {
                      from: time.format(new Date(i.start)),
                      to: time.format(new Date(i.end)),
                    })}
                    className="tap min-h-11 rounded-xl bg-primary-soft px-3 font-bold text-primary"
                  >
                    {time.format(new Date(i.start))}–{time.format(new Date(i.end))}
                  </button>
                ))}
              </div>
              {open?.date === d.date && (
                <RequestForm
                  token={token}
                  day={d.date}
                  start={open.start}
                  end={open.end}
                  time={time}
                  onSent={(label) => {
                    setOpen(null);
                    setSent(label);
                  }}
                  onCancel={() => setOpen(null)}
                />
              )}
            </li>
          ))}
      </ul>
      <p className="mt-6 text-xs text-muted">{t("footer")}</p>
    </main>
  );
}

function RequestForm({
  token,
  day,
  start,
  end,
  time,
  onSent,
  onCancel,
}: {
  token: string;
  day: string;
  start: string;
  end: string;
  time: Intl.DateTimeFormat;
  onSent: (label: string) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("share");
  const from = new Date(start).getTime();
  const to = new Date(end).getTime();
  const starts: number[] = [];
  for (
    let s = Math.ceil(from / (STEP_MIN * 60_000)) * STEP_MIN * 60_000;
    s + STEP_MIN * 60_000 <= to;
    s += STEP_MIN * 60_000
  )
    starts.push(s);
  if (starts.length === 0 && to - from >= STEP_MIN * 60_000) starts.push(from);
  const [at, setAt] = useState(starts[0] ?? from);
  const lengths = LENGTHS.filter((m) => at + m * 60_000 <= to);
  const [len, setLen] = useState(lengths[0] ?? 30);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const len2 = lengths.includes(len) ? len : (lengths[0] ?? 30);
  return (
    <form
      className="mt-3 flex flex-col gap-2 rounded-xl bg-surface-2 p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const s = new Date(at);
        const en = new Date(at + len2 * 60_000);
        const r = await getSupabase().rpc("request_slot", {
          p_token: token,
          p_day: day,
          p_start: s.toISOString(),
          p_end: en.toISOString(),
          p_name: name,
          p_note: note,
        });
        setBusy(false);
        if (r.error) setError(r.error.code === "P0001" ? t("tooMany") : t("error"));
        else onSent(`${time.format(s)}–${time.format(en)}`);
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold">{t("start")}</span>
        <select
          className="min-h-11 rounded-xl bg-surface px-3"
          value={at}
          onChange={(e) => setAt(Number(e.target.value))}
        >
          {starts.map((s) => (
            <option key={s} value={s}>
              {time.format(new Date(s))}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold">{t("length")}</span>
        <select
          className="min-h-11 rounded-xl bg-surface px-3"
          value={len2}
          onChange={(e) => setLen(Number(e.target.value))}
        >
          {lengths.map((m) => (
            <option key={m} value={m}>
              {t("minutes", { n: m })}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold">{t("name")}</span>
        <input
          required
          maxLength={60}
          className="min-h-11 rounded-xl bg-surface px-3"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold">{t("note")}</span>
        <textarea
          maxLength={300}
          rows={2}
          className="rounded-xl bg-surface px-3 py-2"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm font-bold text-accent">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !name.trim()}>
          {t("send")}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
