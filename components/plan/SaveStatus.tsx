"use client";

import { useTranslations } from "next-intl";

export function SaveStatus({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  const t = useTranslations("plan");
  if (state === "idle") return <p aria-live="polite" className="sr-only" />;
  return (
    <p
      aria-live="polite"
      role={state === "error" ? "alert" : "status"}
      className={`mx-4 mb-2 text-sm lg:mx-6 ${state === "error" ? "rounded-xl bg-accent-soft p-3 text-accent" : "text-muted"}`}
    >
      {state === "saving" ? t("saving") : state === "saved" ? t("saved") : t("saveError")}
    </p>
  );
}
