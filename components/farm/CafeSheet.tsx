"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Cup } from "@/components/art/farm/Cup";
import { Sheet } from "@/components/today/BlockSheet";
import { Button } from "@/components/ui/Button";
import { CARD_SIZE, DRINKS, type CoffeeAnswer, type CoffeeSlot, type DrinkId } from "@/content/cafe";
import { cardProgress } from "@/lib/game/cafe";
import type { OrderResult, useCafe } from "@/lib/cafe/useCafe";
import { sfx } from "@/lib/sound/sfx";

/**
 * Som's café (docs/STORY.md): order any drink for a stamp (a game, any time); the first full card of
 * 10 gives the café table. Right after a coffee or tea — at most once a wake-day, never when "game
 * only" is on — it asks whether you drank one in real life too: yes / later / just playing. Closing
 * it is "later" (and leaving it unanswered is asked once at bedtime). After "yes", another real
 * cup can be added. The server decides stamps, gifts and the asking.
 */
export function CafeSheet({ cafe, onClose }: { cafe: ReturnType<typeof useCafe>; onClose: () => void }) {
  const t = useTranslations("cafe");
  const [last, setLast] = useState<{ drink: DrinkId; r: OrderResult } | null>(null);
  const [asking, setAsking] = useState(false);
  const [answered, setAnswered] = useState<CoffeeAnswer | "already" | null>(null);
  const [error, setError] = useState(false);
  const [cup, setCup] = useState<CoffeeSlot | null>(null);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const stamps = last?.r.stamps ?? cafe.status?.stamps ?? 0;
  const { cards, onCard } = cardProgress(stamps);
  // A just-finished card shows full (10/10) until the next order starts a new one.
  const filled = last?.r.reward ? CARD_SIZE : onCard;

  const reply = async (a: CoffeeAnswer) => {
    setAsking(false);
    setError(false);
    // G7 R-C7: "Noted" only once the server has it; on failure the question comes back. Already
    // answered elsewhere (R2-3): say so, the first answer stays.
    const r = await cafe.answer(a);
    if (r === "ok") setAnswered(a);
    else if (r === "already") setAnswered("already");
    else {
      setError(true);
      setAsking(true);
    }
  };

  const close = () => {
    // Closing the question counts as "later" (asked once more at bedtime), never as "no".
    if (asking) void cafe.answer("later"); // "already" is fine too: the first answer stays
    onClose();
  };

  return (
    <Sheet title={t("title")} onClose={close}>
      <p className="mb-3 text-sm text-muted">{t("hint", { n: CARD_SIZE })}</p>

      <section aria-label={t("card")} className="mb-4 rounded-xl bg-surface-2 p-3">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="font-extrabold">{t("card")}</h3>
          <span className="text-sm text-muted">{t("cards", { n: cards })}</span>
        </div>
        <ol aria-label={t("stamps", { n: filled, total: CARD_SIZE })} className="grid grid-cols-5 gap-2">
          {Array.from({ length: CARD_SIZE }, (_, i) => (
            <li
              key={i}
              aria-hidden="true"
              className={`flex aspect-square items-center justify-center rounded-full ${
                i < filled ? "bg-primary-soft" : "border-2 border-dashed border-[var(--art-stone-dark)]"
              }`}
            >
              {i < filled && <span className="h-3 w-3 rounded-full bg-primary" />}
            </li>
          ))}
        </ol>
      </section>

      {last && (
        <div role="status" className="mb-3 rounded-xl bg-primary-soft p-3 font-bold text-primary">
          <p>{t("ordered", { drink: t(`drink.${last.drink}`) })}</p>
          {last.r.reward && "decor" in last.r.reward && <p>{t("rewardTable")}</p>}
          {last.r.reward && "card" in last.r.reward && <p>{t("rewardCard", { n: last.r.reward.card })}</p>}
        </div>
      )}

      {asking && last && (
        <section aria-label={t("askTitle")} className="mb-3 rounded-xl bg-surface-2 p-3">
          <h3 className="mb-1 font-extrabold">{t("askTitle")}</h3>
          <p className="mb-3 text-sm text-muted">{t("askHint")}</p>
          <div className="grid grid-cols-3 gap-2">
            <Button onClick={() => void reply("yes")}>{t("answer.yes")}</Button>
            <Button variant="secondary" onClick={() => void reply("later")}>
              {t("answer.later")}
            </Button>
            <Button variant="secondary" onClick={() => void reply("play")}>
              {t("answer.play")}
            </Button>
          </div>
        </section>
      )}
      {answered && !asking && (
        <p role="status" className="mb-3 text-sm text-muted">
          {t(`answered.${answered}`)}
        </p>
      )}
      {/* G7 R-C5: a "yes" day can add another real cup (the day keeps the latest time of day). */}
      {cafe.status?.answer === "yes" && !asking && !cafe.status.gameOnly && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            disabled={pending}
            onClick={async () => {
              setError(false);
              const s = await cafe.addRealCup();
              if (s) setCup(s);
              else setError(true);
            }}
          >
            {t("addCup")}
          </Button>
          {cup && (
            <p role="status" className="text-sm text-muted">
              {t("addedCup", { slot: t(`slot.${cup}`) })}
            </p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mb-3 rounded-xl bg-accent-soft p-3 font-bold text-accent">
          {t("error")}
        </p>
      )}

      <h3 className="mb-2 font-extrabold">{t("menu")}</h3>
      <ul className="grid grid-cols-4 gap-2">
        {DRINKS.map((d) => (
          <li key={d}>
            <button
              type="button"
              disabled={pending || asking}
              onClick={async () => {
                if (busy.current) return;
                busy.current = true;
                setPending(true);
                setError(false);
                try {
                  const r = await cafe.order(d);
                  if (!r) {
                    setError(true);
                    return;
                  }
                  sfx.pop();
                  if (r.reward) sfx.celebrate();
                  setLast({ drink: d, r });
                  setAnswered(null);
                  setAsking(r.ask);
                } finally {
                  busy.current = false;
                  setPending(false);
                }
              }}
              className="tap flex min-h-11 w-full flex-col items-center rounded-xl bg-surface-2 p-1 disabled:opacity-60"
            >
              <Cup drink={d} className="h-12 w-12" />
              <span className="w-full text-center text-[11px] leading-tight font-bold">
                {t(`drink.${d}`)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">{t("privacy")}</p>
    </Sheet>
  );
}
