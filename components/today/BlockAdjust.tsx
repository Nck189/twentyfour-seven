"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatTime } from "@/lib/format";
import type { TimelineBlock } from "@/lib/today/day";

/**
 * Rule C (Minnie OK 2026-11-27): stretch the current block for today, folded away so Today stays
 * calm. "+15 / +30 min" is a per-day override; the engine shortens what comes after (Free first).
 * When nothing would move (Free itself takes the day's slack; a fixed event can pin a block), it
 * says so instead of saving (G7 C S2-2). The buttons wait for the new end time to show, so two
 * quick taps can't both stretch from the old length.
 */
export function BlockAdjust({
  block,
  timezone,
  onExtend,
}: {
  block: TimelineBlock;
  timezone: string;
  onExtend: (minutes: number) => Promise<void>;
}) {
  const t = useTranslations("today.adjust");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"saved" | "error" | "noRoom" | null>(null);
  // The end time a save was made from: until the new one arrives, the buttons stay off.
  const [savedFrom, setSavedFrom] = useState<number | null>(null);
  const waiting = savedFrom !== null && savedFrom === block.end.getTime();
  const run = async (m: number) => {
    setBusy(true);
    setStatus(null);
    try {
      const from = block.end.getTime();
      await onExtend(m);
      setSavedFrom(from);
      setStatus("saved");
    } catch (e) {
      setStatus(e instanceof Error && e.message === "no_room" ? "noRoom" : "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="mt-3 rounded-xl bg-surface-2">
      <summary className="tap flex min-h-11 cursor-pointer items-center px-3 text-sm font-bold text-muted">
        {t("title")}
      </summary>
      <div className="flex flex-col gap-2 px-3 pb-3">
        <p className="text-sm text-muted">{t("endsAt", { time: formatTime(block.end, timezone) })}</p>
        <div className="flex flex-wrap gap-2">
          {[15, 30].map((m) => (
            <button
              key={m}
              type="button"
              disabled={busy || waiting}
              onClick={() => void run(m)}
              className="tap min-h-11 rounded-full bg-surface px-4 text-sm font-bold disabled:opacity-60"
            >
              {t("extend", { minutes: m })}
            </button>
          ))}
        </div>
        {status && (
          <p role={status === "saved" ? "status" : "alert"} className="text-sm font-bold">
            {t(status)}
          </p>
        )}
      </div>
    </details>
  );
}
