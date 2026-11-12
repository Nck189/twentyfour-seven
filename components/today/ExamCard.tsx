"use client";

import { useTranslations } from "next-intl";
import { SomArt } from "@/components/art/Som";
import { hasExam } from "@/lib/game/exam";
import type { Timeline } from "@/lib/today/day";

/** Exam day with Som (docs/STORY.md): a headband, a snack and one calm line. Nothing to tap. */
export function ExamCard({ timeline }: { timeline: Timeline }) {
  const t = useTranslations("today.exam");
  if (!hasExam(timeline.fixedEvents)) return null;
  return (
    <section
      aria-label={t("label")}
      className="mx-4 mb-3 flex items-center gap-3 rounded-[var(--radius-lg)] bg-primary-soft p-3 lg:mx-6"
    >
      <SomArt pose="carrySeed" headband className="h-14 w-14 shrink-0" />
      <p className="text-sm font-bold">{t("today")}</p>
    </section>
  );
}
