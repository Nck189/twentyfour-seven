"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { TimelineBlock } from "@/lib/today/day";
import { formatTime } from "@/lib/format";

/**
 * Rule C (Minnie OK 2026-11-27): small changes to the current block, folded away so Today stays
 * calm. "+15 / +30 min" stretches today's block (a per-day override; the engine shortens what
 * comes after, Free first). "Not today" sets a block that hasn't started aside as planned: no
 * Day-score hit and never a miss. Once it has started, it simply isn't offered.
 */
export function BlockAdjust({
  block,
  started,
  timezone,
  onExtend,
  onSkip,
}: {
  block: TimelineBlock;
  started: boolean;
  timezone: string;
  onExtend: (minutes: number) => Promise<void>;
  onSkip: () => Promise<void>;
}) {
  const t = useTranslations("today.adjust");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"saved" | "error" | null>(null);
  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setStatus(null);
    try {
      await f();
      setStatus("saved");
    } catch {
      setStatus("error");
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
              disabled={busy}
              onClick={() => void run(() => onExtend(m))}
              className="tap min-h-11 rounded-full bg-surface px-4 text-sm font-bold"
            >
              {t("extend", { minutes: m })}
            </button>
          ))}
          {!started && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(onSkip)}
              className="tap min-h-11 rounded-full bg-surface px-4 text-sm font-bold"
            >
              {t("skip")}
            </button>
          )}
        </div>
        {!started && <p className="text-xs text-muted">{t("skipHint")}</p>}
        {status && (
          <p role={status === "error" ? "alert" : "status"} className="text-sm font-bold">
            {t(status)}
          </p>
        )}
      </div>
    </details>
  );
}
