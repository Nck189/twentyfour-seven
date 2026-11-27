"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { AppIcon } from "@/components/art/AppIcon";
import { markFor } from "@/lib/today/markFor";
import { formatDayMedium, formatTime } from "@/lib/format";
import { showBedCard } from "@/lib/today/bedtime";
import { useNow } from "@/lib/hooks/useNow";
import { currentBlock, type TimelineBlock } from "@/lib/today/day";
import { useBlockClock } from "@/lib/today/blockClock";
import { PushPlanner } from "@/components/push/PushPlanner";
import { useToday } from "@/lib/today/useToday";
import { sfx } from "@/lib/sound/sfx";
import { NightRitual } from "@/components/night/NightRitual";
import { WelcomeCard } from "@/components/onboarding/WelcomeCard";
import { useOnboardingState } from "@/lib/onboarding/useOnboardingState";
import { SetupRewardNotice, TodaySetupHint } from "@/components/setup/SetupCard";
import { useSetupRewards } from "@/lib/setup/useSetupRewards";
import { ExerciseCard } from "@/components/exercise/ExerciseCard";
import { useAnimals } from "@/lib/animals/useAnimals";
import { StreakChip, StreakNotice } from "@/components/streak/StreakChip";
import { useStreak } from "@/lib/streak/useStreak";
import { TodayUnlockLine, UnlockNotice } from "@/components/farm/CollectionBook";
import { FarmStrip } from "./FarmStrip";
import { useFarm } from "@/lib/farm/useFarm";
import { skyPhaseFor } from "@/lib/farm/sky";
import { LastChanceLine } from "@/components/farm/LastChanceLine";
import { AddBlockLine } from "@/components/today/AddBlockLine";
import { BlockAdjust } from "@/components/today/BlockAdjust";
import { MorningCheck } from "@/components/today/MorningCheck";
import { NextLine } from "@/components/today/NextLine";
import { untrackedBlocks, untrackedOn } from "@/content/blocks";
import { useUnlocks } from "@/lib/unlocks/useUnlocks";
import { TodayReviewLine } from "@/components/stats/ReviewLine";
import { Tip } from "@/components/tips/Tip";
import { BlockCheckin } from "./BlockCheckin";
import { BlockTasks } from "./BlockTasks";
import { WelcomeBackCard } from "./WelcomeBackCard";
import { ExamCard } from "./ExamCard";
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
  const setup = useSetupRewards();
  const tb = useTranslations("blocks");
  // The farm, read once just after Today's own data is in (no live updates): the strip on phones
  // and the "one miss from dying" line share this one load (review fix C3). It used to wait a fixed
  // 2 s, which started it after the page had gone quiet: the strip showed late, and a test leaving
  // Today then could cut the read off (WebKit "internal error" on CI, #35/#36).
  const farm = useFarm({ live: false, delayMs: today.status === "loading" ? null : 250 });
  // A failed save makes one low, short note, once per failure (review fix F1).
  const savesFailed = useRef(today.saveError);
  useEffect(() => {
    if (today.saveError > savesFailed.current) sfx.error();
    savesFailed.current = today.saveError;
  }, [today.saveError]);
  // The strip follows check-ins (G7 R-C-8): one farm read a moment after the last change on Today
  // (a log or "I'm up"). Not before the farm's own first read, so opening Today stays one read.
  const farmReload = useRef(farm.reload);
  const farmLoaded = useRef(false);
  useEffect(() => {
    farmReload.current = farm.reload;
    farmLoaded.current = farm.data !== null;
  });
  const wakeSeen = today.wakeCard?.event ? today.wakeCard.event.pressed_at : "";
  useEffect(() => {
    if (!farmLoaded.current) return;
    const timer = setTimeout(() => farmReload.current(), 1500);
    return () => clearTimeout(timer);
  }, [today.logFor, wakeSeen]);
  const animals = useAnimals();
  const streak = useStreak();
  // Re-claim once the streak has settled (a 7-day streak unlocks an egg).
  const unlocks = useUnlocks(streak.view?.best);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [ritualOpen, setRitualOpen] = useState(false);
  const [ritualDismissed, setRitualDismissed] = useState(false);
  const tn = useTranslations("night");
  const [menuOpen, setMenuOpen] = useState(false);
  // Today renders its content only on the client (it waits for the clock), so storage is safe here.
  const [dayOpen, setDayOpen] = useState(() => readDayOpen());
  const [allWarnings, setAllWarnings] = useState(false);

  // Save today's block times for the whole app (auto-quiet and Som's director on any screen,
  // G7 STORY-R6/R8): the block clock reads them every 30 s.
  const saveBlocks = useBlockClock((st) => st.save);
  const blocksKey = today.timeline?.blocks
    .map((b) => `${b.key}@${b.start.getTime()}-${b.end.getTime()}`)
    .join("|");
  useEffect(() => {
    if (!today.timeline) return;
    saveBlocks(
      today.timeline.blocks.map((b) => ({
        key: b.key,
        start: b.start.toISOString(),
        end: b.end.toISOString(),
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- blocksKey captures the block times
  }, [blocksKey, saveBlocks]);

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
  // First-time tips only on a calm screen: not during first-run setup, nor under the Night ritual
  // or another sheet (a tap in there would close them, G7 R-M10-R1).
  const tipsQuiet =
    onboarding.ready && !onboarding.show && !ritualOpen && !autoOffer && !openKey && !menuOpen;
  // Once offered it stays until Done/Close, even when Down ends mid-flow (R-M4-4).
  if (autoOffer && !ritualOpen) setRitualOpen(true);
  // One thing at a time: what's on screen depends on the part of the day.
  // Up before the day's first block (an early "I'm up" starts the day, P2): nothing is current
  // yet, so the next thing is the first block still ahead (G7 R1-fixes F3).
  const next = cur ? tl.blocks[tl.blocks.indexOf(cur) + 1] : tl.blocks.find((b) => b.start > now);
  const wake = today.wakeCard;
  const showWake =
    wake && (wake.canPress || cur?.key === "wake" || cur?.key === "sleep" || (!cur && !!wake.event));
  // After the ritual, near bedtime: "Going to bed" starts Sleep (G7 R-M10-R3-1).
  const sleepBlock = tl.blocks.find((b) => b.key === "sleep");
  const bedCard =
    !!sleepBlock &&
    showBedCard(
      today.logFor(sleepBlock),
      sleepBlock.start,
      now,
      today.nightDone,
      cur?.key,
      text.first10("sleep", sleepBlock.first10) !== null,
    );
  // Blocks a lived action counts as done (R1): the timeline labels them, the ritual skips them.
  const creditedKeys = [
    ...(wake?.event?.in_window && !wake.event.backfilled && wake.event.date === tl.date ? ["wake"] : []),
    ...(today.nightDone ? ["down"] : []),
  ];
  // Rule B: blocks this person doesn't track today (never Wake, Down Time or Sleep). A check-in
  // made anyway shows the normal card from then on.
  const untracked = untrackedOn(today.blockSettings, tl.date);
  const curTracked =
    !!cur &&
    (!untracked.includes(cur.key) || !!(today.logFor(cur).started_at || today.logFor(cur).first10_at));
  const showCurrent = cur && !bedCard && cur.key !== "sleep" && !(cur.key === "down" && !today.nightDone);
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
      {/* M11: upload today's reminders when this device has notifications on (renders nothing).
          No reminders for blocks this person doesn't track (rule B). */}
      <PushPlanner
        day={tl.date}
        blocks={tl.blocks.filter((b) => !untracked.includes(b.key))}
        timezone={today.timezone}
        mode={tl.mode}
      />
      <ScreenHeader
        title={t("title")}
        subtitle={formatDayMedium(tl.date, locale, today.timezone)}
        mark={
          <span data-mark={markFor(cur?.key)} className="shrink-0">
            <AppIcon variant={markFor(cur?.key)} className="h-11 w-11" />
          </span>
        }
        action={
          <div className="flex items-center gap-2">
            {streak.view && <StreakChip view={streak.view} />}
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
          </div>
        }
      />

      {/* Under the header, next to the streak chip it explains. */}
      <Tip id="streak" when={!!streak.view && tipsQuiet} />
      <FarmStrip data={farm.data} failed={farm.status === "error"} phase={skyPhaseFor(cur?.key)} />
      {onboarding.show && <WelcomeCard onLater={() => void onboarding.later()} />}
      {!onboarding.show && <WelcomeBackCard />}
      <ExamCard timeline={tl} />

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
      <Tip id="night" when={isNight && !today.nightDone && tipsQuiet} />

      {showWake && today.wakeMissed && today.tomorrowWake && (
        // Signed up after today's wake window: tomorrow's "I'm up" instead (review fix C1).
        <p className="mx-4 mb-3 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6">
          {t("firstDay.tomorrowWake", { time: formatTime(today.tomorrowWake, today.timezone) })}
        </p>
      )}
      {showWake && !today.wakeMissed && (
        <WakeCard
          key={wake.date}
          target={wake.target}
          wake={wake.event}
          timezone={today.timezone}
          onPress={today.actions.pressWake}
        />
      )}
      <Tip id="wake" when={!!showWake && !today.wakeMissed && tipsQuiet} />
      {wake?.event?.date === tl.date &&
        !today.nightTicketYesterday &&
        !today.firstDay &&
        tl.mode === "normal" && (
          <MorningCheck today={tl.date} timezone={today.timezone} onAdd={today.actions.addAppointment} />
        )}

      {showCurrent && !curTracked && (
        // Rule B: a block this person doesn't track has its time, but no check-in to do.
        <section
          aria-label={t("block.current")}
          className="mx-4 mb-3 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6"
        >
          <p className="text-xs font-bold tracking-wide text-primary uppercase">{t("block.current")}</p>
          <h2 className="text-xl font-extrabold">{text.name(cur.key)}</h2>
          <p className="mt-1 text-sm text-muted">
            {t("block.notTracked", { time: formatTime(cur.end, today.timezone) })}
          </p>
          <button
            type="button"
            onClick={() => setOpenKey(cur.key)}
            className="tap mt-2 min-h-11 rounded-full bg-surface-2 px-4 text-sm font-bold text-primary"
          >
            {t("block.checkInAnyway")}
          </button>
          <BlockTasks userId={today.userId} date={cur.logDate} block={cur.key} />
        </section>
      )}
      {showCurrent && curTracked && (
        <section
          aria-label={t("block.current")}
          className="mx-4 mb-3 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6"
        >
          <p className="text-xs font-bold tracking-wide text-primary uppercase">{t("block.current")}</p>
          <h2 className={`text-xl font-extrabold ${today.earlyDays ? "" : "mb-3"}`}>{text.name(cur.key)}</h2>
          {today.earlyDays && (
            // What this block is, in one line, for the first three days (review fix C5).
            <p className="mb-3 text-sm text-muted">{tb(`hint.${cur.key}`)}</p>
          )}
          <BlockCheckin
            key={`${cur.logDate}:${cur.key}`}
            block={cur}
            log={today.logFor(cur)}
            now={now}
            timezone={today.timezone}
            actions={today.actions}
            ownFirst10={today.blockSettings.find((b) => b.key === cur.key)?.first10_options}
            blockDefault={today.blockSettings.find((b) => b.key === cur.key)}
            onChanged={setup.reload}
          />
          <BlockTasks userId={today.userId} date={cur.logDate} block={cur.key} />
          {cur.key !== "wake" && cur.key !== "down" && cur.key !== "free" && !today.logFor(cur).closed_at && (
            <BlockAdjust
              key={`adjust:${cur.logDate}:${cur.key}`}
              block={cur}
              timezone={today.timezone}
              onExtend={(m) => today.actions.extendBlock(cur, m)}
            />
          )}
        </section>
      )}
      {bedCard && sleepBlock && (
        <section
          aria-label={t("bed.title")}
          className="mx-4 mb-3 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6"
        >
          <p className="text-xs font-bold tracking-wide text-primary uppercase">
            {formatTime(sleepBlock.start, today.timezone)}
          </p>
          <h2 className="mb-1 text-xl font-extrabold">{t("bed.title")}</h2>
          <p className="mb-3 text-sm text-muted">{t("bed.hint")}</p>
          <BlockCheckin
            key={`${sleepBlock.logDate}:sleep`}
            block={sleepBlock}
            log={today.logFor(sleepBlock)}
            now={now}
            timezone={today.timezone}
            actions={today.actions}
            ownFirst10={today.blockSettings.find((b) => b.key === "sleep")?.first10_options}
            blockDefault={today.blockSettings.find((b) => b.key === "sleep")}
            onChanged={setup.reload}
          />
        </section>
      )}
      <Tip id="first10" when={!!showCurrent && tipsQuiet} />

      {next && (
        <NextLine
          block={next}
          label={t("nextAt", { block: text.name(next.key), time: formatTime(next.start, today.timezone) })}
          log={today.logFor(next)}
          now={now}
          // Rule C: "Not today" only before it starts, only for a block that's tracked today.
          canSkip={!["wake", "down", "sleep"].includes(next.key) && !untracked.includes(next.key)}
          onSkip={() => today.actions.setAside(next, "skipped")}
          onUndo={() => today.actions.unsetAside(next)}
        />
      )}

      {napRunning && !menuOpen && <NapCard timezone={today.timezone} />}

      {/* The first day keeps to one thing to do; the rest waits under "More today" (C1, G1). */}
      <FirstDayFold first={today.firstDay} label={t("firstDay.more")}>
        <ExerciseCard animals={animals} />
        <Tip id="exercise" when={!!animals.state && tipsQuiet && !today.firstDay} />

        {!onboarding.show && <TodayReviewLine />}
        <LastChanceLine
          data={farm.data}
          keptToday={
            tl.mode !== "normal" ||
            today.nightTicket ||
            (!!wake?.event?.in_window && !wake.event.backfilled && wake.event.date === tl.date)
          }
        />
        {unlocks && !onboarding.show && <TodayUnlockLine state={unlocks} />}
        {streak.view && (
          <AddBlockLine
            untracked={untrackedBlocks(today.blockSettings)}
            streak={streak.view.streak}
            today={tl.date}
            onAdded={today.reload}
          />
        )}

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
            credited={creditedKeys}
            onOpen={(b) => setOpenKey(b.key)}
          />
        )}
        {/* First day: setup is one more thing to do, so it waits in the fold too (G7 R-C-10). */}
        {today.firstDay && !onboarding.show && <TodaySetupHint state={setup.state} />}
      </FirstDayFold>

      {streak.view && <StreakNotice view={streak.view} />}
      {unlocks && <UnlockNotice granted={unlocks.granted} />}
      {setup.state && <SetupRewardNotice granted={setup.state.granted} />}
      {!today.firstDay && !onboarding.show && <TodaySetupHint state={setup.state} />}

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
          goToBed={today.actions.goToBed}
          timezone={today.timezone}
          credited={creditedKeys}
          untracked={untracked}
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

/**
 * On the account's first day, the secondary cards sit in one closed "More today" (review fix C1);
 * from day 2 they show as usual.
 */
function FirstDayFold({ first, label, children }: { first: boolean; label: string; children: ReactNode }) {
  if (!first) return <>{children}</>;
  return (
    <details className="mx-4 mb-3 rounded-[var(--radius-lg)] bg-surface lg:mx-6">
      <summary className="tap flex min-h-11 cursor-pointer items-center px-4 font-bold text-primary">
        {label}
      </summary>
      <div className="-mx-4 pb-2 lg:-mx-6">{children}</div>
    </details>
  );
}
