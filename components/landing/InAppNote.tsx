"use client";

import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { isInAppBrowser } from "@/lib/platform/inAppBrowser";

const noop = () => () => {};

/**
 * Shown inside LINE's, Instagram's or another app's own browser: open the page in Safari or
 * Chrome (review fix B3). "Copy link" falls back to showing the address to copy by hand when
 * the clipboard isn't available there (G7 R-B-5).
 */
export function InAppNote() {
  const t = useTranslations("landing");
  const inApp = useSyncExternalStore(
    noop,
    () => isInAppBrowser(navigator.userAgent),
    () => false,
  );
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  if (!inApp) return null;
  return (
    <div role="note" className="rounded-xl bg-primary-soft p-3 text-sm">
      <p className="font-bold text-primary">{t("inApp")}</p>
      <button
        type="button"
        onClick={() => {
          const done = navigator.clipboard?.writeText(window.location.origin);
          if (!done) setState("manual");
          else
            done.then(
              () => setState("copied"),
              () => setState("manual"),
            );
        }}
        className="tap mt-2 min-h-11 rounded-full bg-surface px-4 font-bold"
      >
        {t("copyLink")}
      </button>
      <p role="status" className="mt-2">
        {state === "copied" && t("copied")}
        {state === "manual" && (
          <>
            {t("copyManual")} <span className="font-bold break-all select-all">{window.location.origin}</span>
          </>
        )}
      </p>
    </div>
  );
}
