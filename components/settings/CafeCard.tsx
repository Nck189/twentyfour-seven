"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useCafe } from "@/lib/cafe/useCafe";
import { Toggle } from "./SoundCard";

/** More → Som's café: "use the café in the game only" (never ask about real coffee). */
export function CafeCard() {
  const t = useTranslations("cafe");
  const cafe = useCafe();
  const [busy, setBusy] = useState(false);
  return (
    <section className="mx-4 mb-3 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6">
      <h2 className="mb-1 text-lg font-bold">{t("title")}</h2>
      <Toggle
        label={t("gameOnly")}
        hint={t("gameOnlyHint")}
        on={cafe.status?.gameOnly ?? false}
        disabled={!cafe.status || busy}
        onChange={async (on) => {
          setBusy(true);
          try {
            await cafe.setGameOnly(on);
          } finally {
            setBusy(false);
          }
        }}
      />
    </section>
  );
}
