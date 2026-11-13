"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { SomArt } from "@/components/art/Som";
import { Button } from "@/components/ui/Button";
import { sfx } from "@/lib/sound/sfx";
import { useWelcomeBack } from "@/lib/welcome/useWelcomeBack";

/**
 * Coming back after days away (playtest R1 R3): a kind card with one tap and a gift, then a small
 * 3-day "back on track" goal. Never mentions what was missed. Story chapter "R" (docs/STORY.md):
 * Som wakes up, stretches and is glad to see you, instead of plain card text.
 */
export function WelcomeBackCard() {
  const t = useTranslations("welcomeBack");
  const { state, claimWelcome, claimGoal } = useWelcomeBack();
  const [busy, setBusy] = useState(false);
  const [gift, setGift] = useState<"welcome" | "goal" | null>(null);
  if (!state) return null;
  const goal = state.goal;
  const goalOpen = goal && !goal.claimed && state.today <= goal.ends;

  if (state.lapsed) {
    return (
      <section
        aria-label={t("title")}
        className="mx-4 mb-3 flex flex-col gap-2 rounded-[var(--radius-lg)] bg-primary-soft p-4 lg:mx-6"
      >
        <div className="flex items-center gap-3">
          <SomArt pose="stretch" className="h-20 w-20 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold text-primary">{t("title")}</h2>
            <p className="font-bold">{t("som")}</p>
          </div>
        </div>
        <p>{t("body")}</p>
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            if (await claimWelcome()) {
              sfx.celebrate();
              setGift("welcome");
            }
            setBusy(false);
          }}
        >
          {t("start")}
        </Button>
      </section>
    );
  }
  if (!goalOpen && !gift) return null;
  return (
    <section
      aria-label={t("goalTitle")}
      className="mx-4 mb-3 flex flex-col gap-2 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6"
    >
      {gift && (
        <p role="status" className="font-bold text-primary">
          {t(gift === "welcome" ? "gift" : "goalGift")}
        </p>
      )}
      {goalOpen && (
        <>
          <p className="font-bold">{t("goalTitle")}</p>
          <p className="text-sm text-muted">
            {t("goalBody", { done: Math.min(goal.done, goal.need), need: goal.need })}
          </p>
          {goal.done >= goal.need && (
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                if (await claimGoal()) {
                  sfx.celebrate();
                  setGift("goal");
                }
                setBusy(false);
              }}
            >
              {t("goalClaim")}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
