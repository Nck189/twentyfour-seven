"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { formatDayLong, formatTime } from "@/lib/format";
import { useNow } from "@/lib/hooks/useNow";
import { currentBlock, type TimelineBlock } from "@/lib/today/day";
import { useToday } from "@/lib/today/useToday";
import { NightRitual } from "@/components/night/NightRitual";
import { WelcomeCard } from "@/components/onboarding/WelcomeCard";
import { useOnboardingState } from "@/lib/onboarding/useOnboardingState";
import { BlockCheckin } from "./BlockCheckin";
import { Sheet } from "./BlockSheet";
import { ModeCard } from "./ModeCard";
import { NapCard, isNapRunning } from "./NapCard";
import { Timeline } from "./Timeline";
import { useBlockText } from "./useBlockText";
import { WakeCard } from "./WakeCard";

/** The ritual sheet opens by itself once per night (at Down Time); afterwards only from the banner. */
const offeredKey = (date: string) => `247-ritual-offered-${date}`;
function wasOffered(date: string): boolean {
  try {
    return sessionStorage.getItem(offeredKey(date)) === "1";
  } catch {
    return false;
  }
}
function markOffered(date: string) {
  try {
    sessionStorage.setItem(offeredKey(date), "1");
  } catch {
    // ignore
  }
}

/** Whether "See the whole day" was left open (a per-device convenience). */
const DAY_OPEN_KEY = "247-today-day-open";
function readDayOpen(): boolean {
  try {
    return localStorage.getItem(DAY_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}
function writeDayOpen(open: boolean) {
  try {
    localStorage.setItem(DAY_OPEN_KEY, open ? "1" : "0");
  } catch {
    // ignore
  }
}

/** Placeholder before the client clock exists (never rendered: the loading state shows instead). */
const EPOCH = new Date(0);

export function TodayScreen() {
  const t = useTranslations("today");
  const tc = useTranslations("common");
  const locale = useLocale();
  const text = useBlockText();
  const clock = useNow(30_000);
  const now = clock ?? EPOCH;
  const today = useToday(now);
  const onboarding = useOnboardingState();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [ritualOpen, setRitualOpen] = useState(false);
  const [ritualDismissed, setRitualDismissed] = useState(false);
  const tn = useTranslations("night");
  const [menuOpen, setMenuOpen] = useState(false);
  // Today renders its content only on the client (it waits for the clock), so storage is safe here.
  const [dayOpen, setDayOpen] = useState(() => readDayOpen());
  const [allWarnings, setAllWarnings] = useState(false);

  if (!clock || today.status === "loading") {
    return (
      <>
        <ScreenHeader title={t("title")} />
        <p role="status" className="px-4 text-muted lg:px-6">
          {tc("loading")}
        </p>
      </>
    );
  }
  if (today.status === "error" || !today.timeline) {
    return (
      <>
        <ScreenHeader title={t("title")} />
        <div
          role="alert"
          className="mx-4 flex flex-col items-start gap-3 rounded-[var(--radius-lg)] bg-accent-soft p-4 text-accent lg:mx-6"
        >
          <p>{today.status === "error" ? t("loadError") : t("empty")}</p>
          <Button variant="secondary" onClick={today.reload}>
            {tc("retry")}
          </Button>
        </div>
      </>
    );
  }

  const tl = today.timeline;
  const cur = currentBlock(tl, now);
  const open: TimelineBlock | undefined = tl.blocks.find((b) => b.key === openKey);
  const isNight = cur?.key === "down" || cur?.key === "sleep";
  // Not while the first-run card is up (or still loading): a new user sets up their day first.
  const autoOffer =
    cur?.key === "down" &&
    onboarding.ready &&
    !onboarding.show &&
    !today.nightDoneAtLoad &&
    !ritualDismissed &&
    !wasOffered(tl.date);
  // Once offered it stays until Done/Close, even when Down ends mid-flow (R-M4-4).
  if (autoOffer && !ritualOpen) setRitualOpen(true);
  // One thing at a time: what's on screen depends on the part of the day.
  const next = cur ? tl.blocks[tl.blocks.indexOf(cur) + 1] : undefined;
  const wake = today.wakeCard;
  const showWake = wake && (wake.canPress || cur?.key === "wake" || cur?.key === "sleep");
  const showCurrent = cur && cur.key !== "sleep" && !(cur.key === "down" && !today.nightDone);
  const napRunning = isNapRunning();
  const warnings = allWarnings ? tl.warnings : tl.warnings.slice(0, 1);
  const warningText = (w: (typeof tl.warnings)[number]) =>
    w.type === "short_sleep"
      ? t("warnings.short_sleep", { hours: Math.round((w.sleepMin / 60) * 10) / 10 })
      : w.type === "bedtime_drift"
        ? t("warnings.bedtime_drift", { minutes: Math.abs(w.deltaMin) })
        : t(`warnings.${w.type}`);

  return (
    <>
      <ScreenHeader
        title={t("title")}
        subtitle={formatDayLong(tl.date, locale, today.timezone)}
        action={
          <button
            type="button"
            aria-label={t("menu.open")}
            onClick={() => setMenuOpen(true)}
            className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
              <circle cx="5.5" cy="12" r="2" fill="currentColor" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
              <circle cx="18.5" cy="12" r="2" fill="currentColor" />
            </svg>
          </button>
        }
      />

      {onboarding.show && <WelcomeCard onLater={() => void onboarding.later()} />}

      {tl.mode !== "normal" && (
        <p className="mx-4 mb-3 inline-block rounded-full bg-primary-soft px-3 py-1 text-sm font-bold text-primary lg:mx-6">
          {t("mode.badge", { mode: t(`mode.${tl.mode}`) })}
        </p>
      )}

      {tl.warnings.length > 0 && (
        <div className="mx-4 mb-3 flex flex-col gap-1 lg:mx-6">
          <ul className="flex flex-col gap-1">
            {warnings.map((w, i) => (
              <li key={i} className="rounded-xl bg-warn-soft px-3 py-2 text-sm font-bold text-warn">
                {warningText(w)}
              </li>
            ))}
          </ul>
          {tl.warnings.length > 1 && (
            <button
              type="button"
              aria-expanded={allWarnings}
              onClick={() => setAllWarnings((v) => !v)}
              className="tap min-h-11 self-start rounded-xl px-2 text-sm font-bold text-warn"
            >
              {allWarnings ? t("warningsLess") : t("warningsMore", { count: tl.warnings.length - 1 })}
            </button>
          )}
        </div>
      )}

      {today.saveError > 0 && (
        <div
          role="alert"
          className="mx-4 mb-3 flex items-center justify-between gap-2 rounded-xl bg-accent-soft p-3 text-accent lg:mx-6"
        >
          <span>{t("saveError")}</span>
          <Button variant="secondary" onClick={() => void today.retrySave()}>
            {tc("retry")}
          </Button>
        </div>
      )}

      {(isNight || today.nightDone) && (
        <section className="mx-4 mb-3 flex flex-col gap-2 rounded-[var(--radius-lg)] bg-primary-soft p-4 lg:mx-6">
          {today.nightDone ? (
            <p className="font-bold text-primary">{tn("done")}</p>
          ) : (
            <>
              <p className="font-bold text-primary">{tn("offer")}</p>
              <Button onClick={() => setRitualOpen(true)}>{tn("start")}</Button>
            </>
          )}
        </section>
      )}

      {showWake && (
        <WakeCard
          key={wake.date}
          target={wake.target}
          wake={wake.event}
          timezone={today.timezone}
          onPress={today.actions.pressWake}
        />
      )}

      {showCurrent && (
        <section
          aria-label={t("block.current")}
          className="mx-4 mb-3 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6"
        >
          <p className="text-xs font-bold tracking-wide text-primary uppercase">{t("block.current")}</p>
          <h2 className="mb-3 text-xl font-extrabold">{text.name(cur.key)}</h2>
          <BlockCheckin
            key={`${cur.logDate}:${cur.key}`}
            block={cur}
            log={today.logFor(cur)}
            now={now}
            timezone={today.timezone}
            actions={today.actions}
            ownFirst10={today.blockSettings.find((b) => b.key === cur.key)?.first10_options}
          />
        </section>
      )}

      {next && (
        <p className="mx-4 mb-3 text-muted lg:mx-6">
          {t("nextAt", { block: text.name(next.key), time: formatTime(next.start, today.timezone) })}
        </p>
      )}

      {napRunning && !menuOpen && <NapCard timezone={today.timezone} />}

      <div className="mx-4 mb-2 lg:mx-6">
        <button
          type="button"
          aria-expanded={dayOpen}
          onClick={() => {
            setDayOpen((v) => !v);
            writeDayOpen(!dayOpen);
          }}
          className="tap min-h-11 rounded-xl px-2 font-bold text-primary"
        >
          {dayOpen ? t("hideDay") : t("showDay")}
        </button>
      </div>
      {dayOpen && (
        <Timeline
          timeline={tl}
          logFor={today.logFor}
          now={now}
          timezone={today.timezone}
          currentKey={cur?.key}
          onOpen={(b) => setOpenKey(b.key)}
        />
      )}

      {menuOpen && (
        <Sheet title={t("menu.title")} onClose={() => setMenuOpen(false)}>
          <div className="flex flex-col gap-5">
            <NapCard timezone={today.timezone} bare />
            <ModeCard mode={tl.mode} onChange={today.actions.setMode} bare />
          </div>
        </Sheet>
      )}

      {(ritualOpen || autoOffer) && (
        <NightRitual
          timeline={tl}
          logFor={today.logFor}
          markMissed={today.actions.markMissed}
          closeDone={(b) => today.actions.close(b, new Date())}
          complete={today.actions.completeNightRitual}
          onClose={() => {
            markOffered(tl.date);
            setRitualOpen(false);
            setRitualDismissed(true);
          }}
        />
      )}

      {open && (
        <Sheet title={text.name(open.key)} onClose={() => setOpenKey(null)}>
          <BlockCheckin
            key={`${open.logDate}:${open.key}`}
            block={open}
            log={today.logFor(open)}
            now={now}
            timezone={today.timezone}
            actions={today.actions}
            ownFirst10={today.blockSettings.find((b) => b.key === open.key)?.first10_options}
          />
        </Sheet>
      )}
    </>
  );
}
