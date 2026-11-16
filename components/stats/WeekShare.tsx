"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { textPicture } from "@/lib/share/picture";
import { usedSince, weekShare } from "@/lib/stats/stats";
import type { StatsData } from "@/lib/stats/useStats";
import type { StreakView } from "@/lib/streak/useStreak";

/**
 * G4: "Share my week" as a small picture for IG/LINE stories — days logged, perfect days, the
 * streak and the best block. Nothing private (no tasks, names, times or notes). Drawn ahead of the
 * tap so the iOS share sheet opens inside the gesture.
 */
export function WeekShare({ data, streak }: { data: StatsData; streak: StreakView | null }) {
  const t = useTranslations("stats.share");
  const blocks = useTranslations("blocks");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const text = useMemo(() => {
    const s = weekShare(data.days, data.today, usedSince(data.days));
    return [
      t("title"),
      t("days", { n: s.days }),
      t("perfect", { n: s.perfectDays }),
      ...(streak && streak.streak > 0 ? [t("streak", { n: streak.streak })] : []),
      ...(s.bestBlock ? [t("best", { block: blocks(`name.${s.bestBlock}`) })] : []),
    ].join("\n");
  }, [data, streak, t, blocks]);
  useEffect(() => {
    let cancelled = false;
    void textPicture(text)
      .then((b) => {
        if (!cancelled) setFile(new File([b], "my-week.png", { type: "image/png" }));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [text]);
  return (
    <section
      aria-label={t("cardTitle")}
      className="mx-4 mb-3 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6"
    >
      <h2 className="mb-1 text-lg font-bold">{t("cardTitle")}</h2>
      <p className="mb-3 text-sm text-muted">{t("hint")}</p>
      <Button
        variant="secondary"
        disabled={!file}
        onClick={() => {
          if (!file) return;
          setMsg(null);
          if (navigator.canShare?.({ files: [file] }))
            navigator.share({ files: [file] }).then(
              () => setMsg({ ok: true, text: t("ready") }),
              (e: unknown) => {
                if (!(e instanceof DOMException && e.name === "AbortError"))
                  setMsg({ ok: false, text: t("error") });
              },
            );
          else {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(file);
            a.download = file.name;
            a.click();
            URL.revokeObjectURL(a.href);
            setMsg({ ok: true, text: t("ready") });
          }
        }}
      >
        {t("button")}
      </Button>
      {msg && (
        <p
          role={msg.ok ? "status" : "alert"}
          className={`mt-2 text-sm font-bold ${msg.ok ? "text-primary" : "text-accent"}`}
        >
          {msg.text}
        </p>
      )}
    </section>
  );
}
