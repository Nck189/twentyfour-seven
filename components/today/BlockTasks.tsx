"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ActualPrompt } from "@/components/backlog/ActualPrompt";
import { DEFAULT_BLOCK } from "@/lib/backlog";
import { useBacklog } from "@/lib/backlog/useBacklog";
import type { BlockKey } from "@/content/blocks";
import { sfx } from "@/lib/sound/sfx";
import { CheckRow } from "./Checkbox";

/**
 * The backlog tasks planned into this block today (playtest R1 R5: the plan you made shows up on
 * the day you live). Ticking one finishes it (coins are the server's call); hidden when none.
 */
export function BlockTasks({
  userId,
  date,
  block,
}: {
  userId: string | null;
  date: string;
  block: BlockKey;
}) {
  const t = useTranslations("today.block");
  const backlog = useBacklog(userId);
  const [coins, setCoins] = useState<number | null>(null);
  // M14 estimate vs actual: finishing an estimated task here asks too (same as Plan).
  const [asking, setAsking] = useState<string | null>(null);
  const askItem = backlog.items.find((i) => i.id === asking && (i.estimate_min ?? 0) > 0);
  const items = backlog.items.filter(
    (i) =>
      i.scheduled_date === date &&
      (i.block ?? DEFAULT_BLOCK) === block &&
      (i.status === "scheduled" || i.status === "done"),
  );
  if (items.length === 0 && !askItem) return null;
  return (
    <section aria-label={t("tasks")} className="mt-3">
      <h3 className="mb-1 text-sm font-bold text-muted">{t("tasks")}</h3>
      <div className="flex flex-col gap-2">
        {items.map((i) => {
          const done = i.status === "done";
          return (
            <CheckRow
              key={i.id}
              checked={done}
              label={i.title}
              emphasis={!done && i.priority === "must"}
              onToggle={async () => {
                if (done) {
                  sfx.untick();
                  void backlog.reopen(i.id);
                  return;
                }
                sfx.tick();
                const granted = await backlog.complete(i.id);
                if (granted) setCoins(granted);
                if (granted !== null && (i.estimate_min ?? 0) > 0) setAsking(i.id);
              }}
            />
          );
        })}
      </div>
      {askItem && (
        <ActualPrompt
          item={askItem as typeof askItem & { estimate_min: number }}
          onPick={(min) => {
            setAsking(null);
            void backlog.update(askItem.id, { actual_min: min });
          }}
          onSkip={() => setAsking(null)}
        />
      )}
      {coins !== null && (
        <p role="status" className="mt-1 text-sm font-bold text-primary">
          {t("taskCoins", { n: coins })}
        </p>
      )}
    </section>
  );
}
