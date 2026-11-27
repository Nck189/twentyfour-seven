"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckRow } from "@/components/today/Checkbox";
import { useBlockText } from "@/components/today/useBlockText";
import { CORE_BLOCKS, OPTIONAL_BLOCKS, isTracked, type BlockKey, type BlockSetting } from "@/content/blocks";
import { loadBlocks, saveTracked } from "@/lib/blocks/tracked";
import { localDate } from "@/lib/time";

/**
 * More → Set up → "Blocks I track" (rule B, Minnie OK 2026-11-27). Wake, Down Time and Sleep are
 * always on; the other four can be turned off. A change starts with the next day (it never
 * rewrites today or the past), and the row says so until then.
 */
export function TrackedBlocksCard() {
  const t = useTranslations("tracked");
  const text = useBlockText();
  const [blocks, setBlocks] = useState<BlockSetting[] | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    loadBlocks().then(
      (b) => {
        if (!live) return;
        setBlocks(b);
        setState(b ? "ready" : "error");
      },
      () => live && setState("error"),
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  // A change not started yet (it starts with the next day).
  const pending = (k: BlockKey) => {
    const last = blocks?.find((b) => b.key === k)?.tracked_log?.at(-1);
    return !!last && last.from > localDate(new Date());
  };

  return (
    <section id="tracked" className="mx-4 mb-3 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6">
      <h2 className="mb-1 text-lg font-bold">{t("title")}</h2>
      <p className="mb-3 text-sm text-muted">{t("hint")}</p>
      <p className="mb-2 text-sm font-bold">
        {t("always", { list: CORE_BLOCKS.map((k) => text.name(k)).join(", ") })}
      </p>
      {state === "loading" && (
        <p role="status" className="text-muted">
          {t("loading")}
        </p>
      )}
      {state === "error" && (
        <div
          role="alert"
          className="flex flex-col items-start gap-2 rounded-xl bg-accent-soft p-3 text-accent"
        >
          <p>{t("loadFailed")}</p>
          <Button
            variant="secondary"
            onClick={() => {
              setState("loading");
              setAttempt((a) => a + 1);
            }}
          >
            {t("retry")}
          </Button>
        </div>
      )}
      {state === "ready" && blocks && (
        <div className="flex flex-col gap-2">
          {OPTIONAL_BLOCKS.map((k) => (
            <div key={k} className="flex flex-col gap-1">
              <CheckRow
                checked={isTracked(blocks, k)}
                label={text.name(k)}
                disabled={busy}
                onToggle={async () => {
                  setBusy(true);
                  setMsg(null);
                  try {
                    setBlocks(await saveTracked(k, !isTracked(blocks, k)));
                    setMsg({ ok: true, text: t("saved") });
                  } catch {
                    setMsg({ ok: false, text: t("failed") });
                  } finally {
                    setBusy(false);
                  }
                }}
              />
              {pending(k) && <p className="px-3 text-xs text-muted">{t("fromTomorrow")}</p>}
            </div>
          ))}
        </div>
      )}
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className="mt-2 text-sm font-bold">
          {msg.text}
        </p>
      )}
    </section>
  );
}
