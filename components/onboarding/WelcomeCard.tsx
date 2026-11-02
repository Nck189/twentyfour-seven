"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { MoonIcon, SunriseIcon } from "@/components/ui/Icons";

/** First open: a gentle offer to set up (never blocking; "Later" counts as skipped). */
export function WelcomeCard({ onLater }: { onLater: () => void }) {
  const t = useTranslations("onboarding");
  return (
    <section
      aria-labelledby="welcome-title"
      className="mx-4 mb-3 flex flex-col gap-3 rounded-[var(--radius-lg)] bg-primary-soft p-4 lg:mx-6"
    >
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex shrink-0 items-center gap-1 text-primary">
          <MoonIcon className="h-6 w-6" />
          <SunriseIcon className="h-6 w-6" />
        </span>
        <h2 id="welcome-title" className="font-extrabold text-primary">
          {t("cardTitle")}
        </h2>
      </div>
      <p className="text-sm text-ink">{t("cardHint")}</p>
      <div className="flex gap-2">
        <Link
          href="/welcome"
          className="tap inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-primary px-4 font-bold text-on-primary"
        >
          {t("start")}
        </Link>
        <Button variant="ghost" onClick={onLater}>
          {t("later")}
        </Button>
      </div>
    </section>
  );
}
