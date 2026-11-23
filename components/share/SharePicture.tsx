"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { AppMark } from "@/components/art/AppMark";
import { AnimalArt } from "@/components/art/farm/Animals";
import { CropArt } from "@/components/art/farm/CropArt";
import { Farmhouse } from "@/components/art/farm/Farmhouse";
import { SomArt } from "@/components/art/Som";
import { StreakSun } from "@/components/art/Streak";
import { Button } from "@/components/ui/Button";
import { SITE_HOST, siteUrl, type LinkSource } from "@/content/site";
import { logEvent } from "@/lib/db/events";
import { cardPicture, type CardInput } from "@/lib/share/cardPicture";
import { GENERIC_FARM, loadFarmSnapshot, type FarmSnapshot } from "@/lib/share/farmSnapshot";
import { getSupabase } from "@/lib/supabase/client";

/** Tags its one art child (an <svg>) with the slot it's drawn into. */
function Slot({ name, children }: { name: string; children: ReactElement }) {
  return <div ref={(el) => el?.querySelector("svg")?.setAttribute("data-slot", name)}>{children}</div>;
}

export type SharePictureProps = {
  /** What is shared (logged with the event; no private data). */
  kind: "week" | "hatch" | "capsule" | "streak";
  title: string;
  lines: CardInput["lines"];
  ring?: CardInput["ring"];
  /** One piece of art shown large (a proud moment). */
  hero?: ReactElement;
  fileName: string;
  label: string;
  variant?: "primary" | "secondary";
  className?: string;
};

/**
 * A "share" button that makes a picture of her own farm (review fix A4): her crops, animals and
 * farmhouse, the app's address and a QR code. Drawn ahead of the tap so the iOS share sheet opens
 * inside the gesture; browsers that can't share files download it. Nothing private is on it.
 */
export function SharePicture({
  kind,
  title,
  lines,
  ring,
  hero,
  fileName,
  label,
  variant = "secondary",
  className,
}: SharePictureProps) {
  const t = useTranslations("share.picture");
  const art = useRef<HTMLDivElement>(null);
  const [farm, setFarm] = useState<FarmSnapshot | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadFarmSnapshot(getSupabase()).then((f) => {
      if (!cancelled) setFarm(f);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const scene = useMemo(
    () =>
      farm ? [...farm.crops.map((_, i) => `crop${i}`), ...farm.animals.map((_, i) => `animal${i}`)] : [],
    [farm],
  );
  const caption = t("caption");
  useEffect(() => {
    let cancelled = false;
    if (!farm || !art.current) return;
    const source: LinkSource = kind === "week" ? "week" : "moment";
    void cardPicture({
      title,
      lines,
      ring,
      hero: hero ? "hero" : undefined,
      scene,
      footer: { host: SITE_HOST, caption, url: siteUrl("/", source) },
      art: art.current,
    })
      .then((b) => {
        if (!cancelled) setFile(new File([b], fileName, { type: "image/png" }));
      })
      // No picture: no dead button (G7 R-A-5).
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // `hero` is art chosen by the caller for this moment; its identity changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farm, scene, title, lines, ring, caption, fileName, kind]);

  const f = farm ?? GENERIC_FARM;
  // A proud moment loses nothing without the button; the week card says why there's none.
  if (failed)
    return kind === "week" ? (
      <p role="alert" className="text-sm font-bold text-accent">
        {t("error")}
      </p>
    ) : null;
  return (
    <div className={className}>
      <div ref={art} hidden aria-hidden="true">
        <Slot name="mark">
          <AppMark />
        </Slot>
        <Slot name="som">
          <SomArt />
        </Slot>
        <Slot name="house">
          <Farmhouse level={f.house} />
        </Slot>
        <Slot name="streak">
          <StreakSun />
        </Slot>
        {f.crops.map((c, i) => (
          <Slot key={`c${i}`} name={`crop${i}`}>
            <CropArt cropId={c} stage={3} status="ready" />
          </Slot>
        ))}
        {f.animals.map((a, i) => (
          <Slot key={`a${i}`} name={`animal${i}`}>
            <AnimalArt species={a} idle={false} />
          </Slot>
        ))}
        {hero && <Slot name="hero">{hero}</Slot>}
      </div>
      <Button
        variant={variant}
        disabled={!file}
        onClick={() => {
          if (!file) return;
          setMsg(null);
          void logEvent("share_made", { kind });
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
        {label}
      </Button>
      {msg && (
        <p
          role={msg.ok ? "status" : "alert"}
          className={`mt-2 text-sm font-bold ${msg.ok ? "text-primary" : "text-accent"}`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
