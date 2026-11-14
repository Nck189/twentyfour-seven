"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { estimateSummary, MIN_TASKS, type EstimateSummary } from "@/lib/stats/estimates";
import { getSupabase } from "@/lib/supabase/client";

/**
 * Estimates vs real time (M14, SPEC §9 planning-fallacy analytics), in plain words: how much
 * longer tasks take than planned, how often they run over, and which tags run over most.
 */
export function EstimateCard() {
  const t = useTranslations("stats.estimates");
  const locale = useLocale();
  const [s, setS] = useState<EstimateSummary | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await getSupabase()
        .from("backlog_items")
        .select("estimate_min, actual_min, tag")
        .not("actual_min", "is", null)
        .gt("estimate_min", 0);
      if (!cancelled) setS(r.error ? null : estimateSummary(r.data ?? []));
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  if (s === undefined) return null;
  const x = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const pct = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
  return (
    <section aria-label={t("title")} className="mx-4 mb-3 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6">
      <h2 className="mb-1 text-lg font-bold">{t("title")}</h2>
      {!s ? (
        <p className="text-sm text-muted">{t("empty", { n: MIN_TASKS })}</p>
      ) : (
        <>
          <p className="text-2xl font-extrabold">{t("ratio", { x: x.format(s.ratio) })}</p>
          <p className="mb-2 text-sm text-muted">{t("over", { p: pct.format(s.overShare), n: s.n })}</p>
          {s.byTag.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm">
              {s.byTag.slice(0, 3).map((g) => (
                <li key={g.tag}>{t("tag", { tag: g.tag, x: x.format(g.ratio) })}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
