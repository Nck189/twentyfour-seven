"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { BlockLog } from "@/lib/today/useToday";
import type { TimelineBlock } from "@/lib/today/day";

/**
 * Today's "Next" line. Rule C (Minnie OK 2026-11-27): a block that hasn't started yet can be set
 * aside for today ("Not today": planned, so no Day-score hit and never a miss), with an undo. Once
 * its start time has passed the offer is gone, so a skipped block can't be erased after the fact
 * (G7 C S2-1).
 */
export function NextLine({
  block,
  label,
  log,
  now,
  canSkip,
  onSkip,
  onUndo,
}: {
  block: TimelineBlock;
  label: string;
  log: BlockLog;
  now: Date;
  canSkip: boolean;
  onSkip: () => Promise<void>;
  onUndo: () => Promise<void>;
}) {
  const t = useTranslations("today.adjust");
  const [busy, setBusy] = useState(false);
  const before = now.getTime() < block.start.getTime();
  const fresh = !log.started_at && !log.first10_at && !log.closed_at && !log.miss_reason;
  const skipped = log.planned_deviation && fresh;
  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    try {
      await f();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-4 mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 lg:mx-6">
      <p className="text-muted">
        {label}
        {skipped && <span className="font-bold"> · {t("skipped")}</span>}
      </p>
      {canSkip && before && fresh && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(skipped ? onUndo : onSkip)}
          className="tap min-h-11 rounded-full bg-surface-2 px-4 text-sm font-bold"
        >
          {skipped ? t("undo") : t("skip")}
        </button>
      )}
    </div>
  );
}
