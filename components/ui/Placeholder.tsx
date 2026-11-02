"use client";

import { useTranslations } from "next-intl";
import { AppMark } from "@/components/art/AppMark";
import { ScreenHeader } from "./ScreenHeader";

type Section = "today" | "plan" | "farm" | "stats";

/** Temporary screen body until the milestone that builds the real screen. */
export function Placeholder({ section }: { section: Section }) {
  const t = useTranslations(section);
  return (
    <>
      <ScreenHeader title={t("title")} />
      <section className="mx-4 mt-2 flex flex-col items-center rounded-[var(--radius-lg)] bg-surface p-8 text-center lg:mx-6">
        <AppMark className="mb-3 h-16 w-16" />
        <p className="font-bold">{t("placeholder")}</p>
        <p className="text-muted">{t("comingSoon")}</p>
      </section>
    </>
  );
}
