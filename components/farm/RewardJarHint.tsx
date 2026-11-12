"use client";

import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { REWARD_HINT_COINS } from "@/content/economy";

const KEY = "rewardJarHintSeen";

/**
 * The reward jar isn't pushed on anyone (Minnie 2026-11-11): one quiet line the first time coins
 * reach 300, gone for good once closed. Remembered per browser (a convenience, not data).
 */
export function RewardJarHint({ coins }: { coins: number }) {
  const t = useTranslations("shop");
  // Read once from this browser (server render: hidden, so nothing flashes).
  const stored = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return localStorage.getItem(KEY) === "1";
      } catch {
        return true;
      }
    },
    () => true,
  );
  const [closed, setClosed] = useState(false);
  const seen = stored || closed;
  if (seen || coins < REWARD_HINT_COINS) return null;
  return (
    <p className="mx-4 mt-3 flex items-center gap-2 text-sm text-muted lg:mx-6">
      <span className="min-w-0 flex-1">{t("jarHint")}</span>
      <button
        type="button"
        className="tap min-h-11 min-w-11 rounded-xl px-2 font-bold text-primary"
        onClick={() => {
          setClosed(true);
          try {
            localStorage.setItem(KEY, "1");
          } catch {
            /* private mode: it just shows again next time */
          }
        }}
      >
        {t("jarHintClose")}
      </button>
    </p>
  );
}
