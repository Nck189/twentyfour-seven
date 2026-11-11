"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import type { BlockKey } from "@/content/blocks";
import { DEFAULT_TAGS } from "@/content/defaults";
import { CheckRow } from "@/components/today/Checkbox";
import { useBlockText } from "@/components/today/useBlockText";
import { Button } from "@/components/ui/Button";
import { CheckIcon, ChevronIcon, FlagIcon, StepsIcon, TagIcon } from "@/components/ui/Icons";
import { Segmented } from "@/components/ui/Segmented";
import { DEFAULT_BLOCK, type BacklogItem, type Priority } from "@/lib/backlog";
import type { ItemPatch } from "@/lib/backlog/useBacklog";
import { sfx } from "@/lib/sound/sfx";
import { ChipGroup } from "./ChipGroup";
import { useDuration } from "./useDuration";

const ESTIMATES = [15, 30, 60, 90, 120, 180];
/** Blocks a task can go into (not Sleep / Wake / Down). */
const TASK_BLOCKS: BlockKey[] = ["focus", "work", "gradation", "free"];

/**
 * Edit a backlog item. Essentials first (title, priority, estimate, when — "Move to…" is the tap
 * fallback for every drag); project, deadline and steps fold under "More".
 */
export function ItemSheet({
  item,
  days,
  onUpdate,
  onSchedule,
  onComplete,
  onReopen,
  onRemove,
}: {
  item: BacklogItem;
  /** The 7 days on the week strip. */
  days: { date: string; label: string; weekday: string; num: number }[];
  onUpdate: (patch: ItemPatch) => void;
  onSchedule: (date: string | null, block?: BlockKey) => void;
  onComplete: () => Promise<number | null>;
  onReopen: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations("backlog");
  const tt = useTranslations("tags");
  const text = useBlockText();
  const dur = useDuration();
  const [title, setTitle] = useState(item.title);
  const [step, setStep] = useState("");
  const [reward, setReward] = useState<string | null>(null);
  // Project, deadline and steps fold away; icons on the button show which are set.
  const [more, setMore] = useState(false);
  const done = item.status === "done";

  function addStep(e: FormEvent) {
    e.preventDefault();
    const label = step.trim();
    if (!label) return;
    setStep("");
    onUpdate({ checklist: [...item.checklist, { id: crypto.randomUUID(), label, done: false }] });
  }

  return (
    <div className="flex flex-col gap-5">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-muted">{t("titleLabel")}</span>
        <input
          value={title}
          maxLength={500}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title.trim() !== item.title && onUpdate({ title: title.trim() })}
          className="min-h-11 rounded-xl bg-surface-2 px-3"
        />
      </label>

      <section aria-label={t("priority.label")} className="flex flex-col gap-1">
        <h3 className="text-sm font-bold text-muted">{t("priority.label")}</h3>
        <Segmented<Priority>
          label={t("priority.label")}
          value={item.priority}
          onChange={(priority) => onUpdate({ priority })}
          options={(["must", "should", "just_start"] as const).map((p) => ({
            value: p,
            label: t(`priority.${p}`),
          }))}
        />
      </section>

      <section aria-label={t("estimate")} className="flex flex-col gap-1">
        <h3 className="text-sm font-bold text-muted">{t("estimate")}</h3>
        <ChipGroup<string>
          label={t("estimate")}
          value={item.estimate_min ? String(item.estimate_min) : null}
          onChange={(v) => onUpdate({ estimate_min: Number(v) })}
          options={ESTIMATES.map((m) => ({ value: String(m), label: dur(m) }))}
        />
      </section>

      <section aria-label={t("moveTo")} className="flex flex-col gap-2">
        <h3 className="text-sm font-bold text-muted">{t("moveTo")}</h3>
        <div role="radiogroup" aria-label={t("moveTo")} className="flex flex-col gap-2">
          <button
            type="button"
            role="radio"
            aria-checked={item.status === "inbox"}
            onClick={() => onSchedule(null)}
            className={`tap min-h-11 self-start rounded-full px-4 text-sm font-bold ${
              item.status === "inbox"
                ? "bg-primary-soft text-primary ring-2 ring-primary ring-inset"
                : "bg-surface-2 text-muted"
            }`}
          >
            {t("toInbox")}
          </button>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
              const on = item.status !== "inbox" && item.scheduled_date === d.date;
              return (
                <button
                  key={d.date}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={d.label}
                  onClick={() => onSchedule(d.date)}
                  className={`tap flex min-h-12 flex-col items-center justify-center rounded-xl text-xs font-bold ${
                    on
                      ? "bg-primary-soft text-primary ring-2 ring-primary ring-inset"
                      : "bg-surface-2 text-muted"
                  }`}
                >
                  <span>{d.weekday}</span>
                  <span className="text-sm text-ink tabular-nums">{d.num}</span>
                </button>
              );
            })}
          </div>
        </div>
        {item.scheduled_date && (
          <Segmented<BlockKey>
            compact
            label={t("block")}
            value={item.block ?? DEFAULT_BLOCK}
            onChange={(b) => onSchedule(item.scheduled_date, b)}
            options={TASK_BLOCKS.map((b) => ({ value: b, label: text.name(b) }))}
          />
        )}
      </section>

      <div className="flex flex-col gap-4">
        <button
          type="button"
          aria-expanded={more}
          onClick={() => setMore((v) => !v)}
          className="tap flex min-h-11 items-center gap-2 rounded-xl bg-surface-2 px-3 text-left font-bold text-muted"
        >
          <span className="flex-1">{t("more")}</span>
          {!more && (
            <span className="flex flex-wrap gap-1">
              {item.tag && <TagIcon className="h-4 w-4" />}
              {item.deadline && <FlagIcon className="h-4 w-4 text-warn" />}
              {item.checklist.length > 0 && <StepsIcon className="h-4 w-4" />}
            </span>
          )}
          <ChevronIcon up={more} className="h-4 w-4" />
        </button>
        {more && (
          <>
            <section aria-label={t("tag")} className="flex flex-col gap-1">
              <h3 className="text-sm font-bold text-muted">{t("tag")}</h3>
              <ChipGroup<string>
                label={t("tag")}
                value={item.tag ?? ""}
                onChange={(v) => onUpdate({ tag: v || null })}
                options={[
                  { value: "", label: t("noTag") },
                  ...DEFAULT_TAGS.map((tag) => ({ value: tag.key, label: tt(tag.key) })),
                ]}
              />
            </section>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-bold text-muted">{t("deadline")}</span>
              <span className="flex gap-2">
                <input
                  type="date"
                  value={item.deadline ?? ""}
                  onChange={(e) => onUpdate({ deadline: e.target.value || null })}
                  className="min-h-11 min-w-0 flex-1 rounded-xl bg-surface-2 px-3"
                />
                {item.deadline && (
                  <Button variant="ghost" onClick={() => onUpdate({ deadline: null })}>
                    {t("clearDeadline")}
                  </Button>
                )}
              </span>
            </label>

            <section aria-label={t("steps")} className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-muted">{t("steps")}</h3>
              {item.checklist.map((c) => (
                <CheckRow
                  key={c.id}
                  checked={c.done}
                  label={c.label}
                  onToggle={() =>
                    onUpdate({
                      checklist: item.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)),
                    })
                  }
                />
              ))}
              <form onSubmit={addStep} className="flex gap-2">
                <input
                  aria-label={t("newStep")}
                  value={step}
                  maxLength={200}
                  onChange={(e) => setStep(e.target.value)}
                  placeholder={t("newStep")}
                  className="min-h-11 min-w-0 flex-1 rounded-xl bg-surface-2 px-3"
                />
                <Button type="submit" variant="secondary">
                  {t("addStep")}
                </Button>
              </form>
            </section>
          </>
        )}
      </div>

      {reward && (
        <p role="status" className="rounded-xl bg-primary-soft p-3 text-center font-bold text-primary">
          {reward}
        </p>
      )}
      <div className="flex flex-col gap-2">
        {done ? (
          <Button variant="secondary" onClick={onReopen}>
            {t("reopen")}
          </Button>
        ) : (
          // Says what it does: finishing the task, not closing the sheet (playtest R1 P3: a green
          // "เสร็จแล้ว" read as "done editing" and completed tasks by accident).
          <Button
            variant="secondary"
            onClick={async () => {
              sfx.pop();
              const coins = await onComplete();
              if (coins !== null) setReward(coins > 0 ? t("coins", { coins }) : t("noCoins"));
            }}
          >
            <CheckIcon className="h-5 w-5" />
            {t("markDone")}
          </Button>
        )}
        <Button variant="ghost" onClick={onRemove}>
          {t("remove")}
        </Button>
      </div>
    </div>
  );
}
