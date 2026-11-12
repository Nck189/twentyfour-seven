"use client";

import { useDraggable } from "@dnd-kit/core";
import { motion, useReducedMotion } from "framer-motion";
import { sfx } from "@/lib/sound/sfx";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Coin } from "@/components/art/Coin";
import { Button } from "@/components/ui/Button";
import {
  CarryIcon,
  CheckIcon,
  ClockIcon,
  FlagIcon,
  GripIcon,
  StepsIcon,
  TagIcon,
} from "@/components/ui/Icons";
import { CalendarIcon } from "@/components/shell/TabIcons";
import { DEFAULT_TAGS } from "@/content/defaults";
import { NEAR_DEADLINE_DAYS, daysBetween, sortBacklog, type BacklogItem } from "@/lib/backlog";
import { parseCapture, type Capture } from "@/lib/backlog/parse";
import { formatDayShort } from "@/lib/format";
import { usePrefs } from "@/lib/store/prefs";
import { useDuration } from "./useDuration";

/** Priority as a colour edge on the row (Must warm, Should green, Just start quiet). */
const PRIORITY_EDGE: Record<BacklogItem["priority"], string> = {
  must: "bg-warn",
  should: "bg-primary",
  just_start: "bg-surface-2",
};

/** A tiny icon + value pill: reads at a glance instead of a sentence. */
export function Pill({
  icon,
  children,
  tone = "muted",
}: {
  icon: ReactNode;
  children: ReactNode;
  tone?: "muted" | "warn";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-bold ${
        tone === "warn" ? "bg-warn-soft text-warn" : "bg-surface-2 text-muted"
      }`}
    >
      {icon}
      {children}
    </span>
  );
}

/** "+20" with a coin that floats up and fades; a static note with reduced motion / skip. */
function CoinPop({ coins, onDone }: { coins: number; onDone: () => void }) {
  const reduce = useReducedMotion();
  const skip = usePrefs((s) => s.skipAnimations) || Boolean(reduce);
  const t = useTranslations("backlog");
  useEffect(() => {
    const id = setTimeout(onDone, 1400);
    return () => clearTimeout(id);
  }, [onDone]);
  const body = (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-1 text-sm font-extrabold text-primary">
      <Coin className="h-4 w-4" />+{coins}
    </span>
  );
  return (
    <span
      role="status"
      aria-label={t("coins", { coins })}
      className="pointer-events-none absolute top-1 right-14"
    >
      {skip ? (
        body
      ) : (
        <motion.span
          className="inline-block"
          initial={{ y: 6, opacity: 0, scale: 0.8 }}
          animate={{ y: [6, -4, -18], opacity: [0, 1, 0], scale: [0.8, 1.1, 1] }}
          transition={{ duration: 1.3, ease: "easeOut", times: [0, 0.3, 1] }}
        >
          {body}
        </motion.span>
      )}
    </span>
  );
}

/** One task: tap the circle to finish, tap the text to edit, hold the grip to drag to a day. */
export function TaskRow({
  item,
  today,
  timezone,
  onOpen,
  onComplete,
  showDay = false,
  inCard = false,
}: {
  item: BacklogItem;
  today: string;
  timezone: string;
  onOpen: (id: string) => void;
  onComplete: (id: string) => Promise<number | null>;
  showDay?: boolean;
  /** Inside a surface card: use the page tone so the row still stands out. */
  inCard?: boolean;
}) {
  const t = useTranslations("backlog");
  const tt = useTranslations("tags");
  const locale = useLocale();
  const dur = useDuration();
  const [pop, setPop] = useState<number | null>(null);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { title: item.title },
  });
  const done = item.status === "done";
  const knownTag = DEFAULT_TAGS.find((x) => x.key === item.tag);
  const stepsDone = item.checklist.filter((c) => c.done).length;
  const dueIn = item.deadline ? daysBetween(today, item.deadline) : null;

  return (
    <li
      ref={setNodeRef}
      className={`relative flex items-center gap-1 overflow-hidden rounded-xl py-1 pr-1 pl-2 ${inCard ? "bg-bg" : "bg-surface"} ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1.5 ${PRIORITY_EDGE[item.priority]}`}
      />
      <button
        type="button"
        aria-label={t("complete", { title: item.title })}
        aria-pressed={done}
        disabled={done}
        onClick={async () => {
          const coins = await onComplete(item.id);
          if (coins) {
            setPop(coins);
            sfx.coin();
          }
        }}
        className="tap flex h-11 w-11 shrink-0 items-center justify-center"
      >
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full ${
            done ? "bg-primary text-on-primary" : "bg-surface-2 text-transparent"
          }`}
        >
          <CheckIcon className="h-4 w-4" />
        </span>
      </button>
      <button
        type="button"
        onClick={() => onOpen(item.id)}
        aria-label={t("open", { title: item.title })}
        className="tap flex min-h-11 min-w-0 flex-1 flex-col justify-center gap-1 py-1 text-left"
      >
        <span className={`font-bold [overflow-wrap:anywhere] ${done ? "text-muted line-through" : ""}`}>
          {item.title}
        </span>
        <span className="flex flex-wrap gap-1">
          {showDay && item.scheduled_date && (
            <Pill icon={<CalendarIcon className="h-3.5 w-3.5" />}>
              {formatDayShort(item.scheduled_date, locale, timezone)}
            </Pill>
          )}
          {item.estimate_min ? (
            <Pill icon={<ClockIcon className="h-3.5 w-3.5" />}>{dur(item.estimate_min)}</Pill>
          ) : null}
          {item.deadline && dueIn !== null && (
            <Pill
              icon={<FlagIcon className="h-3.5 w-3.5" />}
              tone={dueIn <= NEAR_DEADLINE_DAYS ? "warn" : "muted"}
            >
              {dueIn < 0 ? t("overdue") : formatDayShort(item.deadline, locale, timezone)}
            </Pill>
          )}
          {item.tag && (
            <Pill icon={<TagIcon className="h-3.5 w-3.5" />}>{knownTag ? tt(knownTag.key) : item.tag}</Pill>
          )}
          {item.checklist.length > 0 && (
            <Pill icon={<StepsIcon className="h-3.5 w-3.5" />}>
              {stepsDone}/{item.checklist.length}
            </Pill>
          )}
          {item.carry_count > 0 && (
            <Pill icon={<CarryIcon className="h-3.5 w-3.5" />} tone="warn">
              {item.carry_count}
            </Pill>
          )}
        </span>
      </button>
      {!done && (
        <button
          type="button"
          {...listeners}
          {...attributes}
          aria-label={t("drag", { title: item.title })}
          className="tap flex h-11 w-11 shrink-0 touch-none items-center justify-center rounded-lg text-muted"
        >
          <GripIcon className="h-5 w-5" />
        </button>
      )}
      {pop !== null && <CoinPop coins={pop} onDone={() => setPop(null)} />}
    </li>
  );
}

/** What the quick-capture line will save, shown as pills before Enter. */
function CapturePreview({ capture, timezone }: { capture: Capture; timezone: string }) {
  const t = useTranslations("backlog");
  const tt = useTranslations("tags");
  const locale = useLocale();
  const dur = useDuration();
  const tag = DEFAULT_TAGS.find((x) => x.key === capture.tag);
  const bits: ReactNode[] = [];
  if (capture.priority)
    bits.push(
      <Pill key="p" icon={null}>
        {t(`priority.${capture.priority}`)}
      </Pill>,
    );
  if (capture.estimate_min)
    bits.push(
      <Pill key="e" icon={<ClockIcon className="h-3.5 w-3.5" />}>
        {dur(capture.estimate_min)}
      </Pill>,
    );
  if (capture.scheduled_date)
    bits.push(
      <Pill key="s" icon={<CalendarIcon className="h-3.5 w-3.5" />}>
        {formatDayShort(capture.scheduled_date, locale, timezone)}
      </Pill>,
    );
  if (capture.appointment)
    bits.push(
      <Pill key="a" icon={<CalendarIcon className="h-3.5 w-3.5" />} tone="warn">
        {formatDayShort(capture.appointment.date, locale, timezone)} · {capture.appointment.start}–
        {capture.appointment.end}
      </Pill>,
    );
  if (capture.deadline)
    bits.push(
      <Pill key="d" icon={<FlagIcon className="h-3.5 w-3.5" />} tone="warn">
        {formatDayShort(capture.deadline, locale, timezone)}
      </Pill>,
    );
  if (tag)
    bits.push(
      <Pill key="t" icon={<TagIcon className="h-3.5 w-3.5" />}>
        {tt(tag.key)}
      </Pill>,
    );
  if (!bits.length) return null;
  return (
    <div aria-live="polite" className="flex flex-wrap items-center gap-1">
      <span className="sr-only">{t("willSave")}</span>
      {bits}
    </div>
  );
}

/** SPEC §5 backlog: quick capture (type + Enter, fields parsed), then Inbox and Planned. */
export function BacklogList({
  items,
  today,
  timezone,
  error,
  loadState = "ready",
  onRetry,
  onAdd,
  onOpen,
  onComplete,
}: {
  items: BacklogItem[];
  today: string;
  timezone: string;
  error: boolean;
  loadState?: "loading" | "ready" | "error";
  onRetry?: () => void;
  /** Resolves true when saved; the typed text stays until then (offline: nothing is lost). */
  onAdd: (capture: Capture) => Promise<boolean>;
  onOpen: (id: string) => void;
  onComplete: (id: string) => Promise<number | null>;
}) {
  const t = useTranslations("backlog");
  const tc = useTranslations("common");
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  // Just-finished rows stay for a moment (struck through, coin pop) before leaving the list.
  const [justDone, setJustDone] = useState<string[]>([]);
  const capture = draft.trim() ? parseCapture(draft, today) : null;
  const open = items.filter(
    (i) =>
      i.status === "inbox" || i.status === "scheduled" || (i.status === "done" && justDone.includes(i.id)),
  );
  const inbox = sortBacklog(
    open.filter((i) => !i.scheduled_date),
    today,
  );
  // This week's planned tasks live on the strip + day card; only older unfinished ones show here.
  const earlier = sortBacklog(
    open.filter((i) => i.scheduled_date && i.scheduled_date < today),
    today,
  ).sort((a, b) => (a.scheduled_date ?? "").localeCompare(b.scheduled_date ?? ""));

  async function complete(id: string) {
    setJustDone((j) => [...j, id]);
    const coins = await onComplete(id);
    setTimeout(() => setJustDone((j) => j.filter((x) => x !== id)), 1600);
    return coins;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!capture || adding) return;
    setAdding(true);
    const sent = draft;
    const ok = await onAdd(capture);
    setAdding(false);
    // Clear only once saved, and only if nothing new was typed meanwhile.
    if (ok) setDraft((d) => (d === sent ? "" : d));
  }

  const rows = (list: BacklogItem[], showDay: boolean) =>
    list.map((i) => (
      <TaskRow
        key={i.id}
        item={i}
        today={today}
        timezone={timezone}
        onOpen={onOpen}
        onComplete={complete}
        showDay={showDay}
      />
    ));

  return (
    <section aria-labelledby="backlog-title" className="mx-4 mb-6 flex flex-col gap-3 lg:mx-6">
      <h2 id="backlog-title" className="text-xl font-extrabold">
        {t("title")}
      </h2>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="backlog-capture">
            {t("captureLabel")}
          </label>
          <input
            id="backlog-capture"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("capturePlaceholder")}
            maxLength={500}
            enterKeyHint="done"
            autoComplete="off"
            className="min-h-11 min-w-0 flex-1 rounded-xl bg-surface px-3"
          />
          <Button type="submit" variant="secondary">
            {t("add")}
          </Button>
        </div>
        {capture && <CapturePreview capture={capture} timezone={timezone} />}
      </form>
      {error && (
        <p role="alert" className="rounded-xl bg-accent-soft p-3 text-sm text-accent">
          {t("error")}
        </p>
      )}
      {loadState === "loading" ? (
        <p role="status" className="text-muted">
          {tc("loading")}
        </p>
      ) : loadState === "error" ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-2 rounded-xl bg-accent-soft p-3 text-accent"
        >
          <p>{t("loadError")}</p>
          {onRetry && (
            <Button variant="secondary" onClick={onRetry}>
              {tc("retry")}
            </Button>
          )}
        </div>
      ) : inbox.length + earlier.length === 0 ? (
        <p className="text-muted">{t("empty")}</p>
      ) : (
        <>
          {inbox.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-muted">{t("inbox")}</h3>
              <ul aria-label={t("inbox")} className="flex flex-col gap-2">
                {rows(inbox, false)}
              </ul>
            </div>
          )}
          {earlier.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-muted">{t("earlier")}</h3>
              <ul aria-label={t("earlier")} className="flex flex-col gap-2">
                {rows(earlier, true)}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
