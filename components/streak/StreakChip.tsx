"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { ScarecrowArt, StreakSun } from "@/components/art/Streak";
import { TicketArt } from "@/components/art/Ticket";
import { Sheet } from "@/components/today/BlockSheet";
import type { DayKind } from "@/lib/game/streak";
import type { StreakView } from "@/lib/streak/useStreak";
import { addDays, isoWeekday } from "@/lib/time";

const CELL: Record<DayKind, string> = {
  perfect: "bg-primary",
  minimum: "bg-primary-soft ring-1 ring-primary ring-inset",
  frozen: "bg-[var(--art-blue-light)]",
  paused: "bg-[var(--art-stone)]",
  // Distinct from "before you started" (R-M9-13), soft rather than alarming.
  missed: "bg-warn-soft ring-1 ring-warn/40 ring-inset",
};

/** 5 weeks, Monday first, ending this week: how each settled day went (GitHub-style, SPEC §7). */
function StreakCalendar({ view }: { view: StreakView }) {
  const t = useTranslations("streak");
  const locale = useLocale();
  const fmt = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const monday = addDays(view.today, 1 - isoWeekday(view.today));
  const first = addDays(monday, -28);
  const cells = Array.from({ length: 35 }, (_, i) => addDays(first, i));
  return (
    <div>
      <ul className="grid grid-cols-7 gap-1.5" aria-label={t("calendar")}>
        {cells.map((d) => {
          const k = view.days[d];
          const label = `${fmt.format(new Date(`${d}T00:00:00Z`))}: ${k ? t(`kind.${k}`) : d >= view.today ? t("kind.notYet") : t("kind.none")}`;
          return (
            <li
              key={d}
              aria-label={label}
              className={`aspect-square rounded-md ${k ? CELL[k] : d >= view.today ? "border border-dashed border-line" : "bg-surface-2 opacity-50"}`}
            />
          );
        })}
      </ul>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted" aria-hidden="true">
        {(["perfect", "minimum", "frozen", "paused", "missed"] as DayKind[]).map((k) => (
          <li key={k} className="flex items-center gap-1">
            <span className={`inline-block h-3 w-3 rounded-sm ${CELL[k]}`} />
            {t(`kind.${k}`)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The streak chip in Today's header and its sheet (how it works, scarecrows, the calendar). */
export function StreakChip({ view }: { view: StreakView }) {
  const t = useTranslations("streak");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("chip", { n: view.streak })}
        className="tap flex h-11 shrink-0 items-center gap-1 rounded-full bg-surface-2 pr-3 pl-2 font-extrabold"
      >
        <StreakSun className="h-6 w-6" dim={view.streak === 0} />
        <span aria-hidden="true">{view.streak}</span>
      </button>
      {open && (
        <Sheet title={t("title")} onClose={() => setOpen(false)}>
          <div className="mb-3 flex items-center gap-3">
            <StreakSun className="h-14 w-14" dim={view.streak === 0} />
            <div>
              <p className="text-2xl font-extrabold">{t("days", { n: view.streak })}</p>
              <p className="text-sm text-muted">{t("best", { n: view.best })}</p>
            </div>
          </div>
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-surface-2 p-3">
            <div className="flex" role="img" aria-label={t("scarecrows", { n: view.freezes })}>
              {[0, 1].map((i) => (
                <ScarecrowArt key={i} used={i >= view.freezes} className="h-11 w-11" />
              ))}
            </div>
            <p className="text-sm">{t("scarecrowHint")}</p>
          </div>
          <StreakCalendar view={view} />
          <ul className="mt-3 flex flex-col gap-1 text-sm text-muted">
            <li>{t("ruleMinimum")}</li>
            <li>{t("rulePerfect")}</li>
            <li>{t("rulePause")}</li>
          </ul>
        </Sheet>
      )}
    </>
  );
}

/** "+5 tickets: 7 days in a row!" after a settle paid something. Stays until OK. */
export function StreakNotice({ view }: { view: StreakView }) {
  const t = useTranslations("streak");
  const [seen, setSeen] = useState(false);
  if (seen || view.granted.length === 0) return null;
  const total = view.granted.reduce((n, g) => n + g.amount, 0);
  const lines = view.granted.map((g) =>
    g.reason === "perfect_day" ? t("grantPerfect") : t("grantStreak", { n: Number(g.reason.slice(7)) }),
  );
  return (
    <section
      role="status"
      className="mx-4 mb-3 flex items-center gap-3 rounded-[var(--radius-lg)] bg-primary-soft p-3 lg:mx-6"
    >
      <TicketArt className="h-8 w-12 shrink-0" kind="sunrise" />
      <p className="min-w-0 flex-1 text-sm">
        <span className="block font-bold text-primary">{t("grantTitle", { n: total })}</span>
        {lines.join(" · ")}
      </p>
      <button
        type="button"
        onClick={() => setSeen(true)}
        className="tap min-h-11 rounded-xl px-3 text-sm font-bold text-primary"
      >
        {t("ok")}
      </button>
    </section>
  );
}
