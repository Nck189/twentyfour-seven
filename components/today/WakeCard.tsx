"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { SunIcon } from "@/components/shell/TabIcons";
import { formatTime } from "@/lib/format";
import { sfx } from "@/lib/sound/sfx";
import type { WakeEvent } from "@/lib/today/useToday";

/** SPEC §4.2: one big button, 1 tap from launch. The server decides the window and the ticket. */
export function WakeCard({
  target,
  wake,
  timezone,
  onPress,
}: {
  target: Date;
  wake: WakeEvent | null;
  timezone: string;
  onPress: () => Promise<WakeEvent>;
}) {
  const t = useTranslations("today.wake");
  const tc = useTranslations("today");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  if (wake) {
    const time = formatTime(new Date(wake.pressed_at), timezone);
    return (
      <section
        aria-live="polite"
        className={`mx-4 mb-3 flex items-center gap-3 rounded-[var(--radius-lg)] p-4 lg:mx-6 ${
          wake.in_window ? "bg-warn-soft" : "bg-surface"
        }`}
      >
        <SunIcon className={`h-8 w-8 shrink-0 ${wake.in_window ? "text-warn" : "text-muted"}`} />
        <p className="font-bold">{wake.in_window ? t("doneInWindow", { time }) : t("doneLate", { time })}</p>
      </section>
    );
  }

  return (
    <section className="mx-4 mb-3 lg:mx-6">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(false);
          try {
            const res = await onPress();
            if (res.in_window) sfx.sunrise();
            else sfx.tick();
          } catch {
            setError(true);
          } finally {
            setBusy(false);
          }
        }}
        className="tap flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-[var(--radius-lg)] bg-primary px-4 py-4 text-on-primary"
      >
        <span className="flex items-center gap-2 text-xl font-extrabold">
          <SunIcon className="h-7 w-7" />
          {busy ? t("pressing") : t("button")}
        </span>
        <span className="text-sm opacity-90">
          {t("target", { time: formatTime(target, timezone) })} · {t("hint")}
        </span>
      </button>
      {error && (
        <p role="alert" className="mt-2 rounded-xl bg-accent-soft p-3 text-accent">
          {tc("saveError")}
        </p>
      )}
    </section>
  );
}
