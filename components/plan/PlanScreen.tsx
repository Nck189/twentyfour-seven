"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Sheet } from "@/components/today/BlockSheet";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { formatDayLong, formatTime } from "@/lib/format";
import { usePlan } from "@/lib/plan/usePlan";
import { addDays } from "@/lib/time";
import { planFor, templateFor } from "@/lib/today/day";
import { DayEditor } from "./DayEditor";
import { SaveStatus } from "./SaveStatus";

/** Week view (SPEC §4.1 / M4): any future day can be planned and overridden without touching templates. */
export function PlanScreen() {
  const t = useTranslations("plan");
  const tt = useTranslations("templates");
  const tc = useTranslations("common");
  const locale = useLocale();
  const plan = usePlan();
  const [editing, setEditing] = useState<string | null>(null);

  if (plan.status === "loading" || !plan.ctx || !plan.today) {
    return (
      <>
        <ScreenHeader title={t("title")} />
        <p role="status" className="px-4 text-muted lg:px-6">
          {tc("loading")}
        </p>
      </>
    );
  }
  if (plan.status === "error") {
    return (
      <>
        <ScreenHeader title={t("title")} />
        <div
          role="alert"
          className="mx-4 flex flex-col items-start gap-3 rounded-[var(--radius-lg)] bg-accent-soft p-4 text-accent lg:mx-6"
        >
          <p>{t("loadError")}</p>
          <Button variant="secondary" onClick={plan.reload}>
            {tc("retry")}
          </Button>
        </div>
      </>
    );
  }

  const ctx = plan.ctx;
  const days = Array.from({ length: 7 }, (_, i) => addDays(plan.today!, i));
  const dayLabel = (d: string, i: number) =>
    i === 0 ? t("today") : i === 1 ? t("tomorrow") : formatDayLong(d, locale, ctx.timezone);

  return (
    <>
      <ScreenHeader title={t("title")} subtitle={t("week")} />
      <SaveStatus state={plan.saving} />
      <ol className="mx-4 mb-4 flex flex-col gap-2 lg:mx-6">
        {days.map((d, i) => {
          const p = planFor(ctx, d);
          const tpl = templateFor(ctx, d);
          const row = ctx.dayPlans[d];
          const edited = Boolean(
            row &&
            (row.template_id ||
              row.bedtime_override ||
              row.late_night ||
              row.attending === false ||
              Object.keys(row.overrides ?? {}).length),
          );
          return (
            <li key={d}>
              <button
                type="button"
                onClick={() => setEditing(d)}
                aria-label={t("edit", { day: dayLabel(d, i) })}
                className="tap flex min-h-16 w-full items-center gap-3 rounded-xl bg-surface px-3 py-2 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{dayLabel(d, i)}</span>
                  <span className="block text-sm text-muted">
                    {tpl ? (tpl.name ?? tt(tpl.key as Parameters<typeof tt>[0])) : ""}
                    {edited && (
                      <span className="ml-2 rounded-full bg-primary-soft px-2 text-xs font-bold text-primary">
                        {t("overridden")}
                      </span>
                    )}
                  </span>
                </span>
                <span className="text-right text-sm tabular-nums text-muted">
                  {t("bed", { time: formatTime(p.bedtime, ctx.timezone) })}
                  <br />
                  {t("wake", { time: formatTime(p.wake, ctx.timezone) })}
                </span>
                {p.warnings.length > 0 && (
                  <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full bg-warn" />
                )}
              </button>
            </li>
          );
        })}
      </ol>
      {editing && (
        <Sheet
          title={t("edit", { day: dayLabel(editing, days.indexOf(editing)) })}
          onClose={() => {
            void plan.flush();
            setEditing(null);
          }}
        >
          <DayEditor
            ctx={ctx}
            date={editing}
            onChange={plan.updateDay}
            onSaveDefault={plan.saveBlockDefault}
          />
        </Sheet>
      )}
    </>
  );
}
