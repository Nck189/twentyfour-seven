"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import type { BlockKey } from "@/content/blocks";
import { DEFAULT_TAGS } from "@/content/defaults";
import { CheckRow } from "@/components/today/Checkbox";
import { useBlockText } from "@/components/today/useBlockText";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { DEFAULT_BLOCK, type BacklogItem, type Priority } from "@/lib/backlog";
import type { ItemPatch } from "@/lib/backlog/useBacklog";
import { sfx } from "@/lib/sound/sfx";
import { ChipGroup } from "./ChipGroup";
import { useDuration } from "./useDuration";

const ESTIMATES = [15, 30, 60, 90, 120, 180];
/** Blocks a task can go into (not Sleep / Wake / Down). */
const TASK_BLOCKS: BlockKey[] = ["focus", "work", "gradation", "free"];
const INBOX = "inbox";

/** Edit a backlog item; "Move to…" is the tap fallback for every drag. */
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
  /** The 7 days on the week strip, with their labels. */
  days: { date: string; label: string }[];
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
        <span className="text-sm font-bold text-muted">{t("captureLabel")}</span>
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

      <section aria-label={t("moveTo")} className="flex flex-col gap-2">
        <h3 className="text-sm font-bold text-muted">{t("moveTo")}</h3>
        <ChipGroup<string>
          label={t("moveTo")}
          value={item.status === "inbox" ? INBOX : item.scheduled_date}
          onChange={(v) => onSchedule(v === INBOX ? null : v)}
          options={[
            { value: INBOX, label: t("toInbox") },
            ...days.map((d) => ({ value: d.date, label: d.label })),
          ]}
        />
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
          <Button
            onClick={async () => {
              sfx.pop();
              const coins = await onComplete();
              if (coins !== null) setReward(coins > 0 ? t("coins", { coins }) : t("noCoins"));
            }}
          >
            {t("done")}
          </Button>
        )}
        <Button variant="ghost" onClick={onRemove}>
          {t("remove")}
        </Button>
      </div>
    </div>
  );
}
