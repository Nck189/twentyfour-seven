"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, type JSX } from "react";
import { DayEditor } from "@/components/plan/DayEditor";
import { SaveStatus } from "@/components/plan/SaveStatus";
import { CheckRow } from "@/components/today/Checkbox";
import { Sheet } from "@/components/today/BlockSheet";
import { useBlockText } from "@/components/today/useBlockText";
import { CalendarIcon } from "@/components/shell/TabIcons";
import { Button } from "@/components/ui/Button";
import {
  BoltIcon,
  CheckIcon,
  MoreDotsIcon,
  PeopleIcon,
  PhoneIcon,
  SickIcon,
  SleepyIcon,
} from "@/components/ui/Icons";
import { sfx } from "@/lib/sound/sfx";
import { useBacklog } from "@/lib/backlog/useBacklog";
import { usePlan } from "@/lib/plan/usePlan";
import { addDays } from "@/lib/time";
import type { Timeline, TimelineBlock } from "@/lib/today/day";
import type { BlockLog } from "@/lib/today/useToday";

export const MISS_REASONS = ["sleepy", "phone", "interruption", "social", "sick", "other"] as const;
const REASON_ICON: Record<(typeof MISS_REASONS)[number], (p: { className?: string }) => JSX.Element> = {
  sleepy: SleepyIcon,
  phone: PhoneIcon,
  interruption: BoltIcon,
  social: PeopleIcon,
  sick: SickIcon,
  other: MoreDotsIcon,
};
const PHONE_MIN = 10;

type Props = {
  timeline: Timeline;
  logFor: (b: TimelineBlock) => BlockLog;
  markMissed: (b: TimelineBlock, reason: string) => Promise<void>;
  /** Closes a block that was started (it happened; no miss reason). */
  closeDone: (b: TimelineBlock) => Promise<void>;
  complete: () => Promise<{ ticket_granted: boolean }>;
  onClose: () => void;
};

/**
 * SPEC §4.1 Night ritual: 10-min free phone → close today (miss reasons) → plan tomorrow →
 * alarm + phone away → Goodnight (Night ticket, server-side).
 */
export function NightRitual({ timeline, logFor, markMissed, closeDone, complete, onClose }: Props) {
  const t = useTranslations("night");
  const tc = useTranslations("common");
  const text = useBlockText();
  const tb = useTranslations("backlog");
  const tp = useTranslations("plan");
  const plan = usePlan();
  const backlog = useBacklog(plan.userId);
  const [step, setStep] = useState(0);
  const [phoneEnds, setPhoneEnds] = useState<number | null>(null);
  const [left, setLeft] = useState(PHONE_MIN * 60);
  const [alarmSet, setAlarmSet] = useState(false);
  const [result, setResult] = useState<"ticket" | "already" | "error" | "unsaved" | null>(null);
  const [busy, setBusy] = useState(false);
  const tomorrow = addDays(timeline.date, 1);
  const total = 4;

  useEffect(() => {
    if (phoneEnds === null) return;
    const id = setInterval(() => {
      const s = Math.max(0, Math.round((phoneEnds - new Date().getTime()) / 1000));
      setLeft(s);
      if (s === 0) {
        sfx.alarm();
        clearInterval(id);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phoneEnds]);

  // Blocks of today (Wake…Free) that never closed.
  const open = timeline.blocks.filter((b) => b.key !== "down" && b.key !== "sleep" && !logFor(b).closed_at);
  // Started but never finished = it happened: one tap closes it as done (R-M4-3).
  const started = (b: TimelineBlock) => {
    const l = logFor(b);
    return Boolean(l.started_at || l.first10_at || l.items_done.length);
  };
  const notStarted = open.filter((b) => !started(b));
  // Backlog items planned for today and not finished: carry them (SPEC §5, carry_count).
  const tomorrowAppts = (plan.ctx?.dayPlans[tomorrow]?.overrides.fixed_events ?? []).filter(
    (e) => e.key === "appointment",
  );
  const unfinished = backlog.items.filter(
    (i) => i.status === "scheduled" && i.scheduled_date === timeline.date,
  );

  const steps = [
    // 1. Free phone time
    <div key="phone" className="flex flex-col gap-3">
      <h3 className="text-lg font-bold">{t("phoneTitle")}</h3>
      <p className="text-muted">{t("phoneHint")}</p>
      {phoneEnds === null ? (
        <Button onClick={() => setPhoneEnds(new Date().getTime() + PHONE_MIN * 60_000)}>
          {t("phoneStart")}
        </Button>
      ) : left > 0 ? (
        <p aria-live="polite" className="text-center text-4xl font-extrabold tabular-nums">
          {t("phoneLeft", { minutes: Math.floor(left / 60), seconds: String(left % 60).padStart(2, "0") })}
        </p>
      ) : (
        <p role="status" className="rounded-xl bg-primary-soft p-3 font-bold text-primary">
          {t("phoneDone")}
        </p>
      )}
    </div>,
    // 2. Close today
    <div key="close" className="flex flex-col gap-3">
      <h3 className="text-lg font-bold">{t("closeTitle")}</h3>
      <p className="text-muted">{t("closeHint")}</p>
      {open.length === 0 ? (
        <p role="status" className="rounded-xl bg-primary-soft p-3 font-bold text-primary">
          {t("allClosed")}
        </p>
      ) : (
        <>
          {notStarted.length > 1 && (
            <section aria-label={t("reasonAll")} className="flex flex-col gap-2">
              <h4 className="text-sm font-bold text-muted">{t("reasonAll")}</h4>
              <div className="grid grid-cols-3 gap-2">
                {MISS_REASONS.map((r) => {
                  const Icon = REASON_ICON[r];
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        sfx.tick();
                        for (const b of notStarted) void markMissed(b, r);
                      }}
                      className="tap flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl bg-surface-2 text-xs font-bold text-muted"
                    >
                      <Icon className="h-6 w-6 text-primary" />
                      {t(`reasons.${r}`)}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
          <ul className="flex flex-col gap-2">
            {open.map((b) => (
              <li key={b.key} className="flex flex-col gap-2 rounded-xl bg-surface-2 p-2 pl-3">
                {started(b) ? (
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold">{text.name(b.key)}</p>
                    <button
                      type="button"
                      onClick={() => {
                        sfx.tick();
                        void closeDone(b);
                      }}
                      className="tap inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary-soft px-4 text-sm font-bold text-primary"
                    >
                      <CheckIcon className="h-4 w-4" />
                      {t("closeBlock")}
                      <span className="sr-only"> {text.name(b.key)}</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="font-bold">{text.name(b.key)}</p>
                    <div
                      role="group"
                      aria-label={t("reason", { block: text.name(b.key) })}
                      className="flex justify-between gap-1"
                    >
                      {MISS_REASONS.map((r) => {
                        const Icon = REASON_ICON[r];
                        return (
                          <button
                            key={r}
                            type="button"
                            aria-label={t(`reasons.${r}`)}
                            onClick={() => {
                              sfx.tick();
                              void markMissed(b, r);
                            }}
                            className="tap flex h-11 w-11 items-center justify-center rounded-full bg-surface text-muted"
                          >
                            <Icon className="h-5 w-5" />
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {unfinished.length > 0 && (
        <section aria-label={tb("carryTitle")} className="flex flex-col gap-2">
          <h4 className="font-bold">{tb("carryTitle")}</h4>
          <p className="text-sm text-muted">{tb("carryHint")}</p>
          <ul className="flex flex-col gap-3">
            {unfinished.map((i) => (
              <li key={i.id} className="rounded-xl bg-surface-2 p-3">
                <p className="mb-2 font-bold [overflow-wrap:anywhere]">{i.title}</p>
                <div role="group" aria-label={i.title} className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void backlog.carry(i.id, tomorrow)}
                    className="tap min-h-11 rounded-full bg-surface px-3 text-sm font-bold"
                  >
                    {tb("carryTomorrow")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void backlog.carry(i.id, null)}
                    className="tap min-h-11 rounded-full bg-surface px-3 text-sm font-bold"
                  >
                    {tb("carryInbox")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>,
    // 3. Plan tomorrow
    <div key="plan" className="flex flex-col gap-3">
      <h3 className="text-lg font-bold">{t("planTitle")}</h3>
      {tomorrowAppts.length > 0 && (
        <p className="flex items-center gap-2 rounded-xl bg-warn-soft p-3 text-sm font-bold text-warn">
          <CalendarIcon className="h-4 w-4 shrink-0" />
          {t("tomorrowAppt", { list: tomorrowAppts.map((a) => `${a.title ?? ""} ${a.start}`).join(", ") })}
        </p>
      )}
      <SaveStatus state={plan.saving} />
      {plan.ctx ? (
        <DayEditor
          today={timeline.date}
          ctx={plan.ctx}
          date={tomorrow}
          onChange={plan.updateDay}
          onSaveDefault={plan.saveBlockDefault}
        />
      ) : plan.status === "error" ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-2 rounded-xl bg-accent-soft p-3 text-accent"
        >
          <p>{tp("loadError")}</p>
          <Button variant="secondary" onClick={plan.reload}>
            {tc("retry")}
          </Button>
        </div>
      ) : (
        <p role="status" className="text-muted">
          {tc("loading")}
        </p>
      )}
    </div>,
    // 4. Goodnight
    <div key="night" className="flex flex-col gap-3">
      <h3 className="text-lg font-bold">{t("goodnightTitle")}</h3>
      <p className="text-muted">{t("goodnightHint")}</p>
      <CheckRow checked={alarmSet} label={t("alarmSet")} emphasis onToggle={() => setAlarmSet((v) => !v)} />
      {result === null || result === "error" || result === "unsaved" ? (
        <Button
          disabled={!alarmSet || busy}
          onClick={async () => {
            setBusy(true);
            try {
              // No ticket while tomorrow's plan isn't saved (R-M4-5): fix the connection first.
              if (!(await plan.flush())) {
                setResult("unsaved");
                return;
              }
              const r = await complete();
              setResult(r.ticket_granted ? "ticket" : "already");
              sfx.sunrise();
            } catch {
              setResult("error");
            } finally {
              setBusy(false);
            }
          }}
        >
          {t("goodnight")}
        </Button>
      ) : null}
      {result && (
        <p
          role={result === "error" || result === "unsaved" ? "alert" : "status"}
          className={`rounded-xl p-3 font-bold ${result === "error" || result === "unsaved" ? "bg-accent-soft text-accent" : "bg-primary-soft text-primary"}`}
        >
          {t(result)}
        </p>
      )}
    </div>,
  ];

  return (
    <Sheet title={t("title")} onClose={onClose}>
      <div className="mb-3 flex items-center gap-1.5">
        <span className="sr-only">{t("step", { n: step + 1, total })}</span>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`h-2 rounded-full ${i === step ? "w-6 bg-primary" : i < step ? "w-2 bg-primary" : "w-2 bg-surface-2"}`}
          />
        ))}
      </div>
      {steps[step]}
      <div className="mt-4 flex justify-between gap-2">
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          {t("back")}
        </Button>
        {step < total - 1 ? (
          <Button
            variant={step === 0 && phoneEnds !== null && left > 0 ? "secondary" : "primary"}
            onClick={() => setStep((s) => s + 1)}
          >
            {step === 0 && phoneEnds !== null && left > 0 ? t("phoneSkip") : t("next")}
          </Button>
        ) : (
          result && result !== "error" && <Button onClick={onClose}>{t("done")}</Button>
        )}
      </div>
    </Sheet>
  );
}
