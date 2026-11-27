"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useBlockText } from "@/components/today/useBlockText";
import { OPTIONAL_BLOCKS, type BlockKey } from "@/content/blocks";
import { saveTracked } from "@/lib/blocks/tracked";

const KEY = "247-add-block-nudge";
function readHidden(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
const QUIET_DAYS = 14;

/**
 * Rule B's next step (goal gradient): after a 3-day streak, one quiet offer to track one more block,
 * the next one in day order (`untracked`: the latest choice, so a block added for tomorrow isn't
 * offered again). It starts with the next day. "Not now" hides it for 14 days on this device (a convenience, so
 * browser storage is fine). Never shown while every block is tracked.
 */
export function AddBlockLine({
  untracked,
  streak,
  today,
  onAdded,
}: {
  untracked: readonly BlockKey[];
  streak: number;
  today: string;
  onAdded: () => void;
}) {
  const t = useTranslations("tracked");
  const text = useBlockText();
  const [hiddenUntil, setHiddenUntil] = useState<string | null>(() => readHidden());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; block: BlockKey } | null>(null);
  if (result?.ok)
    return (
      <p role="status" className="mx-4 mb-3 rounded-xl bg-primary-soft p-3 text-sm font-bold lg:mx-6">
        {t("added", { block: text.name(result.block) })}
      </p>
    );
  const next = OPTIONAL_BLOCKS.find((k) => untracked.includes(k));
  if (!next || streak < 3 || (hiddenUntil && hiddenUntil > today)) return null;
  const hide = () => {
    const until = new Date(`${today}T00:00:00Z`);
    until.setUTCDate(until.getUTCDate() + QUIET_DAYS);
    const v = until.toISOString().slice(0, 10);
    setHiddenUntil(v);
    try {
      localStorage.setItem(KEY, v);
    } catch {
      // Private mode: it just shows again next time.
    }
  };
  return (
    <section
      aria-label={t("nudgeTitle")}
      className="mx-4 mb-3 flex flex-col gap-2 rounded-[var(--radius-lg)] bg-primary-soft p-3 lg:mx-6"
    >
      <p className="text-sm font-bold">{t("nudge", { days: streak, block: text.name(next) })}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await saveTracked(next, true);
              setResult({ ok: true, block: next });
              onAdded();
            } catch {
              setResult({ ok: false, block: next });
            } finally {
              setBusy(false);
            }
          }}
          className="tap min-h-11 rounded-full bg-surface px-4 text-sm font-bold text-primary"
        >
          {t("nudgeAdd", { block: text.name(next) })}
        </button>
        <button type="button" onClick={hide} className="tap min-h-11 rounded-full px-4 text-sm font-bold">
          {t("nudgeLater")}
        </button>
      </div>
      {result && !result.ok && (
        <p role="alert" className="text-sm font-bold">
          {t("addFailed")}
        </p>
      )}
    </section>
  );
}
