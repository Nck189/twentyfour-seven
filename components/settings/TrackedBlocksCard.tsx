"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { CheckRow } from "@/components/today/Checkbox";
import { useBlockText } from "@/components/today/useBlockText";
import { CORE_BLOCKS, OPTIONAL_BLOCKS, isTracked, type BlockSetting } from "@/content/blocks";
import { loadBlocks, saveTracked } from "@/lib/blocks/tracked";

/**
 * More → Set up → "Blocks I track" (rule B, Minnie OK 2026-11-27). Wake, Down Time and Sleep are
 * always on; the other four can be turned off. An untracked block keeps its time on Today, with
 * no check-in, no Night-ritual question and no place in the Day score.
 */
export function TrackedBlocksCard() {
  const t = useTranslations("tracked");
  const text = useBlockText();
  const [blocks, setBlocks] = useState<BlockSetting[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    void loadBlocks().then((b) => live && setBlocks(b));
    return () => {
      live = false;
    };
  }, []);

  return (
    <section id="tracked" className="mx-4 mb-3 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6">
      <h2 className="mb-1 text-lg font-bold">{t("title")}</h2>
      <p className="mb-3 text-sm text-muted">{t("hint")}</p>
      <p className="mb-2 text-sm font-bold">
        {t("always", { list: CORE_BLOCKS.map((k) => text.name(k)).join(", ") })}
      </p>
      {blocks === null ? (
        <p role="status" className="text-muted">
          {t("loading")}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {OPTIONAL_BLOCKS.map((k) => (
            <CheckRow
              key={k}
              checked={isTracked(blocks, k)}
              label={text.name(k)}
              disabled={busy}
              onToggle={async () => {
                setBusy(true);
                setMsg(null);
                try {
                  setBlocks(await saveTracked({ [k]: !isTracked(blocks, k) }));
                  setMsg({ ok: true, text: t("saved") });
                } catch {
                  setMsg({ ok: false, text: t("failed") });
                } finally {
                  setBusy(false);
                }
              }}
            />
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
