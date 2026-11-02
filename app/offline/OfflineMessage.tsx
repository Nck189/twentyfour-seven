"use client";

import { useTranslations } from "next-intl";
import { AppMark } from "@/components/art/AppMark";
import { Button } from "@/components/ui/Button";

export function OfflineMessage() {
  const t = useTranslations("common");
  return (
    <main className="safe-top flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <AppMark className="h-20 w-20" />
      <p className="font-bold">{t("offline")}</p>
      <Button onClick={() => window.location.reload()}>{t("retry")}</Button>
    </main>
  );
}
