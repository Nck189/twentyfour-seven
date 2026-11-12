"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { getSupabase } from "@/lib/supabase/client";

/**
 * More → Calendar (M11): a private .ics link for iPhone/iPad/Mac Calendar (the next two weeks of
 * blocks and fixed events). "Make a new link" stops the old one.
 */
export function CalendarCard() {
  const t = useTranslations("push");
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const fetchLink = async (rotate: boolean) => {
    setBusy(true);
    setError(false);
    setCopied(false);
    try {
      const r = await getSupabase().rpc("ics_link", { p_rotate: rotate });
      if (r.error || typeof r.data !== "string") throw r.error;
      setUrl(`${window.location.origin}/ics/${r.data}.ics`);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section id="calendar" className="mx-4 mb-3 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6">
      <h2 className="mb-1 text-lg font-bold">{t("calTitle")}</h2>
      <p className="mb-3 text-sm text-muted">{t("calHint")}</p>
      {!url ? (
        <Button variant="secondary" disabled={busy} onClick={() => void fetchLink(false)}>
          {t("calShow")}
        </Button>
      ) : (
        <>
          <input
            readOnly
            aria-label={t("calTitle")}
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="mb-2 min-h-11 w-full rounded-xl bg-surface-2 px-3 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? t("calCopied") : t("calCopy")}
            </Button>
            <a
              href={url.replace(/^https?:/, "webcal:")}
              className="tap inline-flex min-h-11 items-center rounded-xl bg-primary-soft px-4 font-bold text-primary"
            >
              {t("calOpen")}
            </a>
            <Button variant="ghost" disabled={busy} onClick={() => void fetchLink(true)}>
              {t("calRotate")}
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted">{t("calRotateHint")}</p>
        </>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-bold text-accent">
          {t("calError")}
        </p>
      )}
    </section>
  );
}
