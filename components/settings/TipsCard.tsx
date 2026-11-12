"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useTipsStore } from "@/lib/tips/useTips";

/** More → Tips: bring back the first-time tips (seen ones and "Skip all tips" both reset). */
export function TipsCard() {
  const t = useTranslations("tips");
  const showAgain = useTipsStore((s) => s.showAgain);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <section className="mx-4 mb-3 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6">
      <h2 className="mb-1 text-lg font-bold">{t("title")}</h2>
      <p className="mb-3 text-sm text-muted">{t("moreHint")}</p>
      <Button
        variant="secondary"
        disabled={busy}
        onClick={async () => {
          // Confirm only once the account has saved it: leaving at once must not lose it.
          setBusy(true);
          try {
            await showAgain();
            setDone(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        {t("showAgain")}
      </Button>
      {done && (
        <p role="status" className="mt-2 text-sm font-bold text-primary">
          {t("shownAgain")}
        </p>
      )}
    </section>
  );
}
