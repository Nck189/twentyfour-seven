"use client";

import { useDraggable } from "@dnd-kit/core";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { DEFAULT_TAGS } from "@/content/defaults";
import { daysBetween, sortBacklog, type BacklogItem } from "@/lib/backlog";
import { formatDayLong } from "@/lib/format";
import { useDuration } from "./useDuration";

const PRIORITY_DOT: Record<BacklogItem["priority"], string> = {
  must: "bg-warn",
  should: "bg-primary",
  just_start: "bg-surface-2",
};

function Grip() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      {[7, 12, 17].map((y) => (
        <g key={y}>
          <circle cx="9" cy={y} r="1.6" fill="currentColor" />
          <circle cx="15" cy={y} r="1.6" fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}

/** One backlog row: a drag handle (touch: press and hold) and a tap target that opens the editor. */
function Row({
  item,
  today,
  timezone,
  onOpen,
}: {
  item: BacklogItem;
  today: string;
  timezone: string;
  onOpen: (id: string) => void;
}) {
  const t = useTranslations("backlog");
  const tt = useTranslations("tags");
  const locale = useLocale();
  const dur = useDuration();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { title: item.title },
  });
  const meta: string[] = [];
  const knownTag = DEFAULT_TAGS.find((x) => x.key === item.tag);
  if (item.tag) meta.push(knownTag ? tt(knownTag.key) : item.tag);
  if (item.estimate_min) meta.push(dur(item.estimate_min));
  if (item.deadline) {
    meta.push(
      daysBetween(today, item.deadline) < 0
        ? t("overdue")
        : t("due", { date: formatDayLong(item.deadline, locale, timezone) }),
    );
  }
  if (item.status === "scheduled" && item.scheduled_date)
    meta.push(formatDayLong(item.scheduled_date, locale, timezone));
  if (item.carry_count > 0) meta.push(t("carried", { count: item.carry_count }));

  return (
    <li
      ref={setNodeRef}
      className={`flex items-center gap-2 rounded-xl bg-surface p-2 ${isDragging ? "opacity-40" : ""}`}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        aria-label={t("drag", { title: item.title })}
        className="tap flex h-11 w-11 shrink-0 touch-none items-center justify-center rounded-lg bg-surface-2 text-muted"
      >
        <Grip />
      </button>
      <button
        type="button"
        onClick={() => onOpen(item.id)}
        aria-label={t("open", { title: item.title })}
        className="tap flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span aria-hidden="true" className={`h-3 w-3 shrink-0 rounded-full ${PRIORITY_DOT[item.priority]}`} />
        <span className="min-w-0 flex-1">
          <span className="block font-bold [overflow-wrap:anywhere]">{item.title}</span>
          {meta.length > 0 && <span className="block text-xs text-muted">{meta.join(" · ")}</span>}
        </span>
      </button>
    </li>
  );
}

/** SPEC §5 backlog: quick capture (type + Enter), then Inbox and Planned, near deadlines on top. */
export function BacklogList({
  items,
  today,
  timezone,
  error,
  onAdd,
  onOpen,
}: {
  items: BacklogItem[];
  today: string;
  timezone: string;
  error: boolean;
  onAdd: (title: string) => Promise<void>;
  onOpen: (id: string) => void;
}) {
  const t = useTranslations("backlog");
  const [draft, setDraft] = useState("");
  const open = items.filter((i) => i.status === "inbox" || i.status === "scheduled");
  const inbox = sortBacklog(
    open.filter((i) => i.status === "inbox"),
    today,
  );
  const planned = sortBacklog(
    open.filter((i) => i.status === "scheduled"),
    today,
  ).sort((a, b) => (a.scheduled_date ?? "").localeCompare(b.scheduled_date ?? ""));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    setDraft("");
    await onAdd(title);
  }

  return (
    <section aria-labelledby="backlog-title" className="mx-4 mb-6 flex flex-col gap-3 lg:mx-6">
      <h2 id="backlog-title" className="text-xl font-extrabold">
        {t("title")}
      </h2>
      <form onSubmit={submit} className="flex gap-2">
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
          className="min-h-11 min-w-0 flex-1 rounded-xl bg-surface px-3"
        />
        <Button type="submit" variant="secondary">
          {t("add")}
        </Button>
      </form>
      {error && (
        <p role="alert" className="rounded-xl bg-accent-soft p-3 text-sm text-accent">
          {t("error")}
        </p>
      )}
      {open.length === 0 ? (
        <p className="text-muted">{t("empty")}</p>
      ) : (
        <>
          {inbox.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-muted">{t("inbox")}</h3>
              <ul aria-label={t("inbox")} className="flex flex-col gap-2">
                {inbox.map((i) => (
                  <Row key={i.id} item={i} today={today} timezone={timezone} onOpen={onOpen} />
                ))}
              </ul>
            </div>
          )}
          {planned.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-muted">{t("planned")}</h3>
              <ul aria-label={t("planned")} className="flex flex-col gap-2">
                {planned.map((i) => (
                  <Row key={i.id} item={i} today={today} timezone={timezone} onOpen={onOpen} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
