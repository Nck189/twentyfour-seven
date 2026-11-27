"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { QuickAppointment } from "@/components/plan/QuickAppointment";

const KEY = "247-morning-check";
function readDone(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/**
 * G4 (Minnie OK 2026-11-27): planning at night is when energy is lowest. On a morning after a night
 * without the Night ritual, one small card right after "I'm up": "Anything different today?" One
 * tap says no; an appointment is one line. Hidden for the day once answered (per device; a
 * convenience, so browser storage is fine).
 */
export function MorningCheck({
  today,
  timezone,
  onAdd,
}: {
  today: string;
  timezone: string;
  onAdd: (date: string, title: string, start: string, end: string) => Promise<void>;
}) {
  const t = useTranslations("morningCheck");
  const [doneOn, setDoneOn] = useState<string | null>(() => readDone());
  const [added, setAdded] = useState(false);
  if (doneOn === today) return null;
  const finish = () => {
    setDoneOn(today);
    try {
      localStorage.setItem(KEY, today);
    } catch {
      // Private mode: it may ask again; harmless.
    }
  };
  return (
    <section
      aria-labelledby="morning-check-title"
      className="mx-4 mb-3 flex flex-col gap-3 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6"
    >
      <h2 id="morning-check-title" className="text-lg font-bold">
        {t("title")}
      </h2>
      <p className="-mt-2 text-sm text-muted">{t("hint")}</p>
      <QuickAppointment
        today={today}
        defaultDate={today}
        timezone={timezone}
        onAdd={async (...a) => {
          await onAdd(...a);
          setAdded(true);
        }}
      />
      <button
        type="button"
        onClick={finish}
        className="tap min-h-11 self-start rounded-full bg-surface-2 px-4 text-sm font-bold"
      >
        {added ? t("done") : t("nothing")}
      </button>
    </section>
  );
}
