"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { logEvent } from "@/lib/db/events";
import { formatTime } from "@/lib/format";
import { sfx } from "@/lib/sound/sfx";

const NAP_KEY = "247-nap-ends";

function readNap(): number | null {
  try {
    const v = Number(localStorage.getItem(NAP_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function writeNap(endsAt: number | null) {
  try {
    if (endsAt) localStorage.setItem(NAP_KEY, String(endsAt));
    else localStorage.removeItem(NAP_KEY);
  } catch {
    // Storage unavailable: the nap just won't survive a reload.
  }
}

/**
 * SPEC §4.4 power nap: 20 or 25 min with an alarm. The end time is saved, so a reload or an
 * evicted home-screen app still rings (in the foreground) when you come back. A background
 * alarm on a locked iPhone needs Web Push (M11).
 */
export function NapCard({ timezone }: { timezone: string }) {
  const t = useTranslations("today.nap");
  // Rendered only on the client (Today waits for the clock), so reading storage here is safe.
  const [endsAt, setEndsAt] = useState<number | null>(() => readNap());
  const [ringing, setRinging] = useState(false);

  useEffect(() => {
    if (endsAt === null) return;
    const check = () => {
      if (new Date().getTime() >= endsAt) {
        setRinging(true);
        sfx.alarm();
      }
    };
    const first = setTimeout(check, 0);
    const id = setInterval(check, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [endsAt]);

  function start(minutes: number) {
    const end = new Date().getTime() + minutes * 60_000;
    writeNap(end);
    setEndsAt(end);
    setRinging(false);
    void logEvent("nap_started", { minutes });
  }

  function stop(finished: boolean) {
    void logEvent("nap_finished", { finished });
    writeNap(null);
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
