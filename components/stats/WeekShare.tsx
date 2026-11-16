"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { Button } from "@/components/ui/Button";
import { CropArt } from "@/components/art/farm/CropArt";
import { Farmhouse } from "@/components/art/farm/Farmhouse";
import { SomArt } from "@/components/art/Som";
import { StreakSun } from "@/components/art/Streak";
import type { CropId } from "@/content/crops";
import { weekPicture } from "@/lib/share/weekPicture";
import { usedSince, weekShare } from "@/lib/stats/stats";
import type { StatsData } from "@/lib/stats/useStats";
import type { StreakView } from "@/lib/streak/useStreak";

/**
 * G4: "Share my week" as a small picture for IG/LINE stories — days logged, perfect days, the
 * streak and the best block. Nothing private (no tasks, names, times or notes). Drawn ahead of the
 * tap so the iOS share sheet opens inside the gesture.
 */
const SHARE_CROPS: readonly CropId[] = ["strawberry", "radish", "corn"];

/** Tags its one art child (an <svg>) with the slot it's drawn into. */
function Slot({ name, children }: { name: string; children: ReactElement }) {
  return (
    <div data-slot-wrap={name} ref={(el) => el?.querySelector("svg")?.setAttribute("data-slot", name)}>
      {children}
    </div>
  );
}

export function WeekShare({ data, streak }: { data: StatsData; streak: StreakView | null }) {
  const t = useTranslations("stats.share");
  const blocks = useTranslations("blocks");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const art = useRef<HTMLDivElement>(null);
  const tst = useTranslations("stats.score");
  const input = useMemo(() => {
    const s = weekShare(data.days, data.today, usedSince(data.days));
    return {
      title: t("title"),
      score: s.score,
      scoreLabel: tst("title"),
      lines: [
        { text: t("days", { n: s.days }) },
        { text: t("perfect", { n: s.perfectDays }) },
        ...(streak && streak.streak > 0 ? [{ text: t("streak", { n: streak.streak }), icon: "streak" }] : []),
        ...(s.bestBlock ? [{ text: t("best", { block: blocks(`name.${s.bestBlock}`) }) }] : []),
      ],
    };
  }, [data, streak, t, tst, blocks]);
  // Drawn ahead of the tap so the iOS share sheet opens inside the gesture.
  useEffect(() => {
    let cancelled = false;
    if (!art.current) return;
    void weekPicture({ ...input, art: art.current })
      .then((b) => {
        if (!cancelled) setFile(new File([b], "my-week.png", { type: "image/png" }));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [input]);
  return (
    <section
      aria-label={t("cardTitle")}
      className="mx-4 mb-3 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6"
    >
      <h2 className="mb-1 text-lg font-bold">{t("cardTitle")}</h2>
      {/* The farm drawn into the picture (G4: farm + streak + Day score ring). */}
      <div ref={art} hidden aria-hidden="true">
        <Slot name="house">
          <Farmhouse level={1} />
        </Slot>
        <Slot name="som">
          <SomArt />
        </Slot>
        {SHARE_CROPS.map((c, i) => (
          <Slot key={c} name={`crop${i + 1}`}>
            <CropArt cropId={c} stage={3} status="ready" />
          </Slot>
        ))}
        <Slot name="streak">
          <StreakSun />
        </Slot>
      </div>
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
            // WebKit can drop a download whose URL is already revoked (as ExportCard; R-M14-15).
            setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
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
