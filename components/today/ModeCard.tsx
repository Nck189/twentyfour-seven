"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Segmented } from "@/components/ui/Segmented";

type Mode = "normal" | "vacation" | "sick";

/** SPEC §4.4: Vacation / Sick pause the streak and freeze farm penalties. */
export function ModeCard({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => Promise<void> }) {
  const t = useTranslations("today.mode");
  const tc = useTranslations("today");
  const [error, setError] = useState(false);
  return (
    <section className="mx-4 mb-3 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6">
      <h2 className="mb-2 text-lg font-bold">{t("title")}</h2>
      <Segmented<Mode>
        label={t("title")}
        value={mode}
        onChange={async (m) => {
          setError(false);
          try {
            await onChange(m);
          } catch {
            setError(true);
          }
        }}
        options={[
          { value: "normal", label: t("normal") },
          { value: "vacation", label: t("vacation") },
          { value: "sick", label: t("sick") },
        ]}
      />
      <p className="mt-2 text-sm text-muted">{t("note")}</p>
      {error && (
        <p role="alert" className="mt-2 rounded-xl bg-accent-soft p-3 text-accent">
          {tc("saveError")}
        </p>
      )}
    </section>
  );
}
