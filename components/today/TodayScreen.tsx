"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { formatDayLong } from "@/lib/format";
import { useNow } from "@/lib/hooks/useNow";
import { currentBlock, type TimelineBlock } from "@/lib/today/day";
import { useToday } from "@/lib/today/useToday";
import { BlockCheckin } from "./BlockCheckin";
import { Sheet } from "./BlockSheet";
import { ModeCard } from "./ModeCard";
import { NapCard } from "./NapCard";
import { Timeline } from "./Timeline";
import { useBlockText } from "./useBlockText";
import { WakeCard } from "./WakeCard";

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
  const [openKey, setOpenKey] = useState<string | null>(null);

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
  const showWake = tl.blocks[0] && now.getTime() >= tl.wakeTarget.getTime() - 3 * 3600_000;

  return (
    <>
      <ScreenHeader title={t("title")} subtitle={formatDayLong(tl.date, locale, today.timezone)} />

      {tl.mode !== "normal" && (
        <p className="mx-4 mb-3 inline-block rounded-full bg-primary-soft px-3 py-1 text-sm font-bold text-primary lg:mx-6">
          {t("mode.badge", { mode: t(`mode.${tl.mode}`) })}
        </p>
      )}

      {tl.warnings.length > 0 && (
        <ul className="mx-4 mb-3 flex flex-col gap-1 lg:mx-6">
          {tl.warnings.map((w, i) => (
            <li key={i} className="rounded-xl bg-warn-soft px-3 py-2 text-sm font-bold text-warn">
              {w.type === "short_sleep"
                ? t("warnings.short_sleep", { hours: Math.round((w.sleepMin / 60) * 10) / 10 })
                : w.type === "bedtime_drift"
                  ? t("warnings.bedtime_drift", { minutes: Math.abs(w.deltaMin) })
                  : t(`warnings.${w.type}`)}
            </li>
          ))}
        </ul>
      )}

      {today.saveError && (
        <div
          role="alert"
          className="mx-4 mb-3 flex items-center justify-between gap-2 rounded-xl bg-accent-soft p-3 text-accent lg:mx-6"
        >
          <span>{t("saveError")}</span>
          <Button variant="secondary" onClick={() => void today.retrySave?.()}>
            {tc("retry")}
          </Button>
        </div>
      )}

      {showWake && (
        <WakeCard
          target={tl.wakeTarget}
          wake={today.wake}
          timezone={today.timezone}
          onPress={today.actions.pressWake}
        />
      )}

      {cur && (
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
          />
        </section>
      )}

      <Timeline
        timeline={tl}
        logFor={today.logFor}
        now={now}
        timezone={today.timezone}
        currentKey={cur?.key}
        onOpen={(b) => setOpenKey(b.key)}
      />

      <NapCard timezone={today.timezone} />
      <ModeCard mode={tl.mode} onChange={today.actions.setMode} />

      {open && (
        <Sheet title={text.name(open.key)} onClose={() => setOpenKey(null)}>
          <BlockCheckin
            key={`${open.logDate}:${open.key}`}
            block={open}
            log={today.logFor(open)}
            now={now}
            timezone={today.timezone}
            actions={today.actions}
          />
        </Sheet>
      )}
    </>
  );
}
