"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { AppMark } from "@/components/art/AppMark";
import { Button } from "./Button";

export function ErrorScreen({ kind, onRetry }: { kind: "notFound" | "error"; onRetry?: () => void }) {
  const t = useTranslations("errors");
  const tc = useTranslations("common");
  return (
    <main className="safe-top safe-bottom flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <AppMark className="h-20 w-20" />
      <h1 className="text-2xl font-extrabold">
        {kind === "notFound" ? t("notFoundTitle") : t("errorTitle")}
      </h1>
      <p className="text-muted">{kind === "notFound" ? t("notFoundBody") : t("errorBody")}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {onRetry && <Button onClick={onRetry}>{tc("retry")}</Button>}
        <Link
          href="/today"
          className="tap inline-flex min-h-11 items-center justify-center rounded-xl bg-surface-2 px-4 font-bold text-ink"
        >
          {t("backToToday")}
        </Link>
      </div>
    </main>
  );
}
