"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { COFFEE_SLOTS, type CoffeeSlot } from "@/content/cafe";
import { askAtBedtime } from "@/lib/game/cafe";
import type { useCafe } from "@/lib/cafe/useCafe";

/**
 * The Night ritual's one café question (docs/STORY.md): only when today's answer was "later", or a
 * coffee/tea was ordered and its question left unanswered (G7 R-C6); once, never when "game only"
 * is on. Skipping it leaves the day out of the sleep insight — never counted as "no coffee".
 */
export function CoffeeNightAsk({ cafe }: { cafe: ReturnType<typeof useCafe> }) {
  const t = useTranslations("cafe");
  const [done, setDone] = useState<CoffeeSlot | null>(null);
  const [failed, setFailed] = useState(false);
  const s = cafe.status;
  if (done)
    return (
      <p role="status" className="text-sm text-muted">
        {t("nightThanks")}
      </p>
    );
  if (
    !s ||
    !askAtBedtime({
      answeredToday: s.answer,
      nightAnswered: s.night,
      gameOnly: s.gameOnly,
      orderedToday: s.ordered,
    })
  )
    return null;
  return (
    <section aria-label={t("nightTitle")} className="rounded-xl bg-surface-2 p-3">
      <h4 className="mb-2 font-bold">{t("nightTitle")}</h4>
      <div className="grid grid-cols-2 gap-2">
        {COFFEE_SLOTS.map((slot) => (
          <button
            key={slot}
            type="button"
            onClick={async () => {
              setFailed(false);
              // G7 R-C8: thank only once it's saved; a failure keeps the question to try again.
              if (await cafe.answerNight(slot)) setDone(slot);
              else setFailed(true);
            }}
            className="tap min-h-11 rounded-xl bg-surface px-3 font-bold"
          >
            {t(`slot.${slot}`)}
          </button>
        ))}
      </div>
      {failed && (
        <p role="alert" className="mt-2 text-sm font-bold text-accent">
          {t("error")}
        </p>
      )}
    </section>
  );
}
