"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckRow } from "@/components/today/Checkbox";
import { useBlockText } from "@/components/today/useBlockText";
import { OPTIONAL_BLOCKS, isTracked, type BlockKey, type BlockSetting } from "@/content/blocks";

/**
 * Onboarding (rule B, Minnie OK 2026-11-27): "Which part of your day do you want to change most?"
 * Pick one or two; wake-up, wind-down and bedtime are always in. The rest keep their time on Today
 * with nothing to check in, and can be added any time in More → Set up.
 */
export function TrackStep({
  busy,
  blocks,
  onSave,
}: {
  busy: boolean;
  blocks: readonly BlockSetting[];
  onSave: (tracked: BlockKey[]) => void;
}) {
  const t = useTranslations("onboarding.track");
  const tb = useTranslations("blocks");
  const text = useBlockText();
  // Coming back to this step shows what was saved; a first visit starts empty, so it's a choice.
  const chosen = blocks.some((b) => b.tracked_log?.length);
  const [picked, setPicked] = useState<BlockKey[]>(() =>
    chosen ? OPTIONAL_BLOCKS.filter((k) => isTracked(blocks, k)) : [],
  );
  return (
    <section aria-labelledby="track-title" className="flex flex-col gap-3">
      <h2 id="track-title" className="text-xl font-extrabold">
        {t("title")}
      </h2>
      <p className="text-muted">{t("hint")}</p>
      <div className="flex flex-col gap-2">
        {OPTIONAL_BLOCKS.map((k) => (
          <div key={k} className="flex flex-col gap-1">
            <CheckRow
              checked={picked.includes(k)}
              label={text.name(k)}
              onToggle={() => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))}
            />
            <p className="px-3 text-xs text-muted">{tb(`hint.${k}`)}</p>
          </div>
        ))}
      </div>
      {picked.length > 2 && <p className="text-sm text-muted">{t("many")}</p>}
      <Button disabled={busy} onClick={() => onSave(picked)}>
        {picked.length === 0 ? t("coreOnly") : t("next")}
      </Button>
      <Button variant="secondary" disabled={busy} onClick={() => onSave([...OPTIONAL_BLOCKS])}>
        {t("all")}
      </Button>
    </section>
  );
}
