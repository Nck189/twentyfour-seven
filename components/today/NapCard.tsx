"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { logEvent } from "@/lib/db/events";
import { formatTime } from "@/lib/format";
import { sfx } from "@/lib/sound/sfx";

/** SPEC §4.4 power nap: 20 or 25 min, alarm sound at the end, every nap logged as an event. */
export function NapCard({ timezone }: { timezone: string }) {
  const t = useTranslations("today.nap");
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [ringing, setRinging] = useState(false);

  useEffect(() => {
    if (endsAt === null) return;
    const id = setInterval(() => {
      if (Date.now() >= endsAt) {
        setRinging(true);
        sfx.alarm();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  function start(minutes: number) {
    setEndsAt(new Date().getTime() + minutes * 60_000);
    setRinging(false);
    void logEvent("nap_started", { minutes });
  }

  function stop(finished: boolean) {
    void logEvent("nap_finished", { finished });
    setEndsAt(null);
    setRinging(false);
  }

  return (
    <section className="mx-4 mb-3 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6">
      <h2 className="mb-2 text-lg font-bold">{t("title")}</h2>
      {endsAt === null ? (
        <div className="flex gap-2">
          {[20, 25].map((m) => (
            <Button key={m} variant="secondary" onClick={() => start(m)}>
              {t("start", { minutes: m })}
            </Button>
          ))}
        </div>
      ) : ringing ? (
        <div role="alert" className="flex items-center justify-between gap-2">
          <p className="font-bold text-warn">{t("done")}</p>
          <Button onClick={() => stop(true)}>{t("dismiss")}</Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p aria-live="polite">{t("running", { time: formatTime(new Date(endsAt), timezone) })}</p>
          <Button variant="secondary" onClick={() => stop(false)}>
            {t("stop")}
          </Button>
        </div>
      )}
    </section>
  );
}
