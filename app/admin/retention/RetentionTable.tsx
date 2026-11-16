"use client";

import { useLocale, useTranslations } from "next-intl";
import { RETENTION_DAYS, type Cohort } from "@/lib/stats/retention";

export function RetentionTable({ cohorts, users }: { cohorts: Cohort[]; users: number }) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const pct = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-2xl font-extrabold">{t("title")}</h1>
      <p className="mb-4 text-sm text-muted">{t("hint", { n: users })}</p>
      {cohorts.length === 0 ? (
        <p className="text-muted">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] bg-surface p-3">
          <table className="w-full text-sm">
            <caption className="sr-only">{t("title")}</caption>
            <thead>
              <tr className="text-left text-muted">
                <th scope="col" className="p-2">
                  {t("week")}
                </th>
                <th scope="col" className="p-2">
                  {t("users")}
                </th>
                {RETENTION_DAYS.map((d) => (
                  <th key={d} scope="col" className="p-2">
                    {t("day", { n: d })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => (
                <tr key={c.week} className="border-t border-surface-2">
                  <th scope="row" className="p-2 text-left font-bold">
                    {c.week}
                  </th>
                  <td className="p-2">{c.n}</td>
                  {RETENTION_DAYS.map((d) => (
                    <td key={d} className="p-2">
                      {c.rate[d] === null ? "–" : pct.format(c.rate[d]!)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
