"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useBlockText } from "@/components/today/useBlockText";
import { Button } from "@/components/ui/Button";
import { CheckIcon } from "@/components/ui/Icons";
import type { BlockKey, BlockSetting } from "@/content/blocks";
import { NONE, first10Options } from "@/lib/onboarding";

/** A day in order: wake up → … → sleep. */
const ORDER: BlockKey[] = ["wake", "focus", "work", "gradation", "free", "down", "sleep"];

/**
 * One block at a time: tap a first-10 and the next block slides in (7 taps for the whole day).
 * Own texts are added to the block's choices. A switch turns first-10s off (recommended on).
 */
export function First10Step({
  blocks,
  onPick,
  onAddOwn,
  onUseFirst10,
  onDone,
  onUseAll,
}: {
  blocks: BlockSetting[];
  onPick: (key: BlockKey, value: string | null) => void;
  onAddOwn: (key: BlockKey, text: string) => Promise<void>;
  onUseFirst10: (on: boolean) => void;
  onDone: () => void;
  /** One tap: keep every default, pick suggestion 1 where a block has none, and finish. */
  onUseAll: () => void;
}) {
  const t = useTranslations("onboarding");
  const text = useBlockText();
  const [i, setI] = useState(0);
  const [own, setOwn] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const using = !blocks.every((b) => b.first10 === NONE);
  const key = ORDER[i];
  const setting = blocks.find((b) => b.key === key);
  const options = first10Options(key, setting?.first10_options ?? []);
  const current = setting?.first10 ?? null;

  const next = () => (i < ORDER.length - 1 ? setI(i + 1) : onDone());

  function pick(value: string | null) {
    onPick(key, value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(next, 250);
  }

  async function addOwn(e: FormEvent) {
    e.preventDefault();
    if (!own.trim()) return;
    await onAddOwn(key, own);
    setOwn("");
    next();
  }

  return (
    <section aria-labelledby="ob-first10" className="flex flex-col gap-4">
      <div>
        <h2 id="ob-first10" className="text-xl font-extrabold">
          {t("first10Title")}
        </h2>
        <p className="text-muted">{t("first10Hint")}</p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={using}
        onClick={() => onUseFirst10(!using)}
        className="tap flex min-h-12 items-center justify-between gap-3 rounded-xl bg-surface px-3 text-left font-bold"
      >
        {t("useFirst10")}
        <span
          className={`flex h-7 w-12 items-center rounded-full p-1 ${using ? "bg-primary" : "bg-surface-2"}`}
        >
          <span
            className={`h-5 w-5 rounded-full bg-surface transition-transform ${using ? "translate-x-5" : ""}`}
          />
        </span>
      </button>

      {using && (
        <button
          type="button"
          onClick={onUseAll}
          className="tap flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-bold text-on-primary"
        >
          <CheckIcon className="h-4 w-4" />
          {t("useAll")}
        </button>
      )}

      {!using ? (
        <p role="note" className="rounded-xl bg-warn-soft p-3 text-sm text-warn">
          {t("noFirst10Note")}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Which block: 7 dots, tap one to jump. */}
          <div className="flex items-center justify-center gap-1.5">
            {ORDER.map((k, n) => (
              <button
                key={k}
                type="button"
                aria-label={text.name(k)}
                aria-current={n === i ? "step" : undefined}
                onClick={() => setI(n)}
                className="tap flex h-11 w-11 items-center justify-center"
              >
                <span
                  className={`h-2 rounded-full ${n === i ? "w-6 bg-primary" : n < i ? "w-2 bg-primary" : "w-2 bg-surface-2"}`}
                />
              </button>
            ))}
          </div>
          <h3 className="text-center text-lg font-extrabold">{text.name(key)}</h3>
          <div role="radiogroup" aria-label={text.name(key)} className="flex flex-col gap-2">
            {options.map((o) => {
              const label = text.first10(key, o) ?? "";
              const on = current === o;
              return (
                <button
                  key={o ?? "default"}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => pick(o)}
                  className={`tap flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-left font-bold ${
                    on ? "bg-primary-soft text-primary ring-2 ring-primary ring-inset" : "bg-surface text-ink"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      on ? "bg-primary text-on-primary" : "bg-surface-2 text-transparent"
                    }`}
                  >
                    <CheckIcon className="h-3.5 w-3.5" />
                  </span>
                  <span className="[overflow-wrap:anywhere]">{label}</span>
                </button>
              );
            })}
          </div>
          <form onSubmit={addOwn} className="flex gap-2">
            <input
              aria-label={t("addOwn")}
              value={own}
              maxLength={200}
              onChange={(e) => setOwn(e.target.value)}
              placeholder={t("ownPlaceholder", { block: text.name(key) })}
              className="min-h-11 min-w-0 flex-1 rounded-xl bg-surface px-3"
            />
            <Button type="submit" variant="secondary">
              {t("addButton")}
            </Button>
          </form>
        </div>
      )}
    </section>
  );
}
