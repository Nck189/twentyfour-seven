"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Flowers } from "@/components/art/farm/Plot";
import { StreakSun } from "@/components/art/Streak";
import { Sheet } from "@/components/today/BlockSheet";
import { SEASONS, seasonOf } from "@/content/seasons";
import { festivalMonth, monthRange } from "@/lib/seasons/festival";
import { getSupabase } from "@/lib/supabase/client";
import { addDays, DEFAULT_TZ, zonedInstant } from "@/lib/time";
import { DECOR_ART } from "./DecorShop";

type Stats = { perfect: number; kept: number; best: number; harvests: number; hatched: number };

/** The month in numbers, from the data (day_results + server events). */
function useMonthStats(month: string | null) {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    if (!month) return;
    let cancelled = false;
    void (async () => {
      const client = getSupabase();
      const { from, to } = monthRange(month);
      const [days, events] = await Promise.all([
        client.from("day_results").select("date, kind").gte("date", from).lte("date", to).order("date"),
        client
          .from("events")
          .select("type")
          .in("type", ["harvest", "egg_hatched"])
          .gte("at", zonedInstant(from, 0, DEFAULT_TZ).toISOString())
          .lt("at", zonedInstant(addDays(to, 1), 0, DEFAULT_TZ).toISOString()),
      ]);
      if (cancelled) return;
      let run = 0;
      let best = 0;
      let perfect = 0;
      let kept = 0;
      for (const d of (days.data ?? []) as { kind: string }[]) {
        if (d.kind === "perfect" || d.kind === "minimum") {
          run++;
          kept++;
          if (d.kind === "perfect") perfect++;
          best = Math.max(best, run);
        } else if (d.kind === "missed") run = 0;
      }
      const ev = (events.data ?? []) as { type: string }[];
      setStats({
        perfect,
        kept,
        best,
        harvests: ev.filter((e) => e.type === "harvest").length,
        hatched: ev.filter((e) => e.type === "egg_hatched").length,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [month]);
  return stats;
}

/**
 * This month's season (SPEC §8.8): a calm banner with its picture; in festival months it points
 * to the limited decor. Around a month's end it opens the harvest festival (the monthly review).
 */
export function SeasonBanner({ today }: { today: string }) {
  const t = useTranslations("season");
  const names = useTranslations("seasons");
  const decor = useTranslations("decor");
  const tc = useTranslations("common");
  const locale = useLocale();
  const season = seasonOf(today);
  const fest = festivalMonth(today);
  const [open, setOpen] = useState(false);
  const stats = useMonthStats(open ? fest : null);
  const Art = season.festival ? DECOR_ART[season.festival] : Flowers;
  const monthName = fest
    ? new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { month: "long", timeZone: "UTC" }).format(
        new Date(`${fest}-15T00:00:00Z`),
      )
    : "";
  const next = SEASONS[Number(today.slice(5, 7)) % 12]!;

  return (
    <section
      aria-label={t("banner", { name: names(season.id) })}
      className="mx-4 mb-3 rounded-[var(--radius-lg)] bg-surface p-3 lg:mx-6"
    >
      <div className="flex items-center gap-3">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: `var(--art-${season.tone === "leaf" ? "leaf-light" : `${season.tone}-light`})`,
          }}
        >
          <Art className="h-12 w-12" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold">{t("banner", { name: names(season.id) })}</p>
          {season.festival && (
            <p className="text-sm">{t("festivalItem", { item: decor(season.festival) })}</p>
          )}
        </div>
      </div>
      {fest && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="tap mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-surface font-bold"
        >
          <StreakSun className="h-6 w-6" />
          {t("festivalOpen", { month: monthName })}
        </button>
      )}
      {open && fest && (
        <Sheet title={t("festivalTitle", { month: monthName })} onClose={() => setOpen(false)}>
          <p className="mb-3 text-muted">{t("festivalHint")}</p>
          {stats ? (
            <dl className="grid grid-cols-2 gap-2">
              {(
                [
                  ["statPerfect", stats.perfect],
                  ["statKept", stats.kept],
                  ["statBest", stats.best],
                  ["statHarvests", stats.harvests],
                  ["statHatched", stats.hatched],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="rounded-xl bg-surface-2 p-3">
                  <dt className="text-sm text-muted">{t(k)}</dt>
                  <dd className="text-2xl font-extrabold">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p role="status" className="text-muted">
              {tc("loading")}
            </p>
          )}
          <p className="mt-3 text-sm font-bold">{t("nextSeason", { name: names(next.id) })}</p>
        </Sheet>
      )}
    </section>
  );
}
