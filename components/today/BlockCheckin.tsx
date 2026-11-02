"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { formatTime } from "@/lib/format";
import { sfx } from "@/lib/sound/sfx";
import { isOnTime, isPastBlock, type TimelineBlock } from "@/lib/today/day";
import type { BlockLog } from "@/lib/today/useToday";
import { CheckRow } from "./Checkbox";
import { SwapIcon } from "@/components/ui/Icons";
import { NONE, first10Options } from "@/lib/onboarding";
import { useBlockText } from "./useBlockText";

export type CheckinActions = {
  start: (b: TimelineBlock, at: Date) => Promise<void>;
  toggleFirst10: (b: TimelineBlock, at: Date) => Promise<void>;
  toggleItem: (b: TimelineBlock, itemId: string, at: Date) => Promise<void>;
  close: (b: TimelineBlock, at: Date) => Promise<void>;
  rate: (b: TimelineBlock, at: Date, mood: number | null, energy: number | null) => Promise<void>;
  reopen: (b: TimelineBlock, at: Date) => Promise<void>;
  setLocation: (b: TimelineBlock, loc: "home" | "out", at: Date) => Promise<void>;
  setFirst10?: (b: TimelineBlock, value: string | null) => Promise<void>;
};

function Scale({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label}>
      <span className="mb-1 block text-sm font-bold text-muted">{label}</span>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${label} ${n}`}
            onClick={() => onChange(value === n ? null : n)}
            className={`tap h-11 w-11 shrink-0 rounded-full font-bold ${value === n ? "bg-primary text-on-primary" : "bg-surface-2 text-muted"}`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * One block's check-in (SPEC §4.3), one step at a time: first-10 (auto-starts the block) and
 * the checklist; "Finish" appears once the block has started; after closing, optional location
 * (Focus/Work), mood and energy. Budget: first-10 + 3 items + close = 5 taps.
 */
export function BlockCheckin({
  block,
  log,
  now,
  timezone,
  actions,
  ownFirst10 = [],
}: {
  block: TimelineBlock;
  log: BlockLog;
  now: Date;
  timezone: string;
  actions: CheckinActions;
  /** The user's own first-10 texts for this block (to pick today's). */
  ownFirst10?: string[];
}) {
  const t = useTranslations("today.block");
  const text = useBlockText();
  const [mood, setMood] = useState<number | null>(log.mood);
  const [energy, setEnergy] = useState<number | null>(log.energy);
  const [choosing, setChoosing] = useState(false);
  const past = isPastBlock(block, now);
  const first10Text = text.first10(block.key, block.first10);
  const started = log.started_at ? new Date(log.started_at) : null;
  const closed = Boolean(log.closed_at);

  return (
    <div className="flex flex-col gap-3">
      {(past || log.backfilled) && (
        <p role="note" className="rounded-xl bg-surface-2 p-3 text-sm text-muted">
          {t("backfillNote")}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {started ? (
          <span className="text-sm text-muted">
            {t("started", { time: formatTime(started, timezone) })} ·{" "}
            {log.backfilled ? (
              // A backfill never claims "on time" (no rewards, no inflated stats).
              <span className="text-muted">{t("backfilledStart")}</span>
            ) : (
              <span className={isOnTime(block.start, started) ? "text-primary" : "text-warn"}>
                {isOnTime(block.start, started) ? t("onTime") : t("late")}
              </span>
            )}
          </span>
        ) : (
          <Button
            variant="secondary"
            onClick={() => {
              sfx.tick();
              void actions.start(block, new Date());
            }}
          >
            {t("start")}
          </Button>
        )}
      </div>

      <section aria-label={t("first10")}>
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-muted">{t("first10")}</h3>
          {actions.setFirst10 && !closed && !log.first10_at && (
            <button
              type="button"
              aria-expanded={choosing}
              aria-label={t("changeFirst10")}
              onClick={() => setChoosing((v) => !v)}
              className="tap -my-2 flex h-11 w-11 items-center justify-center rounded-full text-muted"
            >
              <SwapIcon className="h-5 w-5" />
            </button>
          )}
        </div>
        {choosing && actions.setFirst10 && (
          <div role="radiogroup" aria-label={t("changeFirst10")} className="mb-2 flex flex-col gap-1.5">
            {[...first10Options(block.key, ownFirst10), NONE].map((o) => {
              const on = (block.first10 ?? null) === o;
              return (
                <button
                  key={o ?? "default"}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setChoosing(false);
                    void actions.setFirst10!(block, o);
                  }}
                  className={`tap min-h-11 rounded-xl px-3 py-2 text-left text-sm font-bold ${
                    on ? "bg-primary-soft text-primary ring-2 ring-primary ring-inset" : "bg-surface-2"
                  }`}
                >
                  {o === NONE ? t("none") : text.first10(block.key, o)}
                </button>
              );
            })}
          </div>
        )}
        {first10Text ? (
          <CheckRow
            emphasis
            checked={Boolean(log.first10_at)}
            label={first10Text}
            disabled={closed}
            onToggle={() => {
              (log.first10_at ? sfx.untick : sfx.tick)();
              void actions.toggleFirst10(block, new Date());
            }}
          />
        ) : (
          <p className="text-sm text-muted">{t("first10Unset")}</p>
        )}
      </section>

      <section aria-label={t("checklist")}>
        <h3 className="mb-1 text-sm font-bold text-muted">
          {t("checklist")}
          {block.checklist.length > 0 && (
            <span className="ml-2 font-normal">
              {t("items", { done: log.items_done.length, total: block.checklist.length })}
            </span>
          )}
        </h3>
        {block.checklist.length === 0 ? (
          <p className="text-sm text-muted">{t("noChecklist")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {block.checklist.map((item) => {
              const done = log.items_done.includes(item.id);
              return (
                <CheckRow
                  key={item.id}
                  checked={done}
                  label={item.label}
                  disabled={closed}
                  onToggle={() => {
                    (done ? sfx.untick : sfx.tick)();
                    void actions.toggleItem(block, item.id, new Date());
                  }}
                />
              );
            })}
          </div>
        )}
      </section>

      {closed ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted">
              {t("closed", { time: formatTime(new Date(log.closed_at!), timezone) })}
            </span>
            <Button variant="ghost" onClick={() => void actions.reopen(block, new Date())}>
              {t("reopen")}
            </Button>
          </div>
          {(block.key === "focus" || block.key === "work") && (
            <section aria-label={t("location")}>
              <h3 className="mb-1 text-sm font-bold text-muted">{t("location")}</h3>
              <Segmented<"home" | "out">
                label={t("location")}
                value={(log.location ?? "") as "home" | "out"}
                onChange={(v) => void actions.setLocation(block, v, new Date())}
                options={[
                  { value: "home", label: t("home") },
                  { value: "out", label: t("out") },
                ]}
              />
            </section>
          )}
          <p className="text-xs text-muted">
            {t("mood")} / {t("energy")} · {t("optional")}
          </p>
          <Scale
            label={t("mood")}
            value={mood}
            onChange={(v) => {
              setMood(v);
              void actions.rate(block, new Date(), v, energy);
            }}
          />
          <Scale
            label={t("energy")}
            value={energy}
            onChange={(v) => {
              setEnergy(v);
              void actions.rate(block, new Date(), mood, v);
            }}
          />
        </div>
      ) : started || past ? (
        <Button
          onClick={() => {
            sfx.pop();
            void actions.close(block, new Date());
          }}
        >
          {t("close")}
        </Button>
      ) : null}
    </div>
  );
}
