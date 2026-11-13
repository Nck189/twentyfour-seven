"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { PUSH_KINDS, type PushPrefs } from "@/lib/push/schedule";
import { usePush } from "@/lib/push/usePush";
import { Toggle } from "./SoundCard";

/**
 * More → Notifications (M11): turn on after a tap; per-type switches and quiet hours. iPhone/iPad
 * need the Home Screen app (iOS 16.4+); every push shows a notification.
 */
export function NotificationsCard() {
  const t = useTranslations("push");
  const { state, prefs, turnOn, turnOff, savePrefs } = usePush();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<"ok" | "error" | null>(null);
  const [turnOnFailed, setTurnOnFailed] = useState(false);
  // Quiet hours are edited locally and saved when the field is left: the iOS wheel fires a change
  // per scroll step, and saving (and disabling) on each one closed the picker (G7 R-M11-13).
  const [quiet, setQuiet] = useState<{ start: string; end: string } | null>(null);
  const update = async (next: PushPrefs) => {
    setBusy(true);
    setSaved(null);
    try {
      setSaved((await savePrefs(next)) ? "ok" : "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section id="notifications" className="mx-4 mb-3 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6">
      <h2 className="mb-1 text-lg font-bold">{t("settingsTitle")}</h2>
      {state === null ? null : state === "ask" ? (
        <>
          <p className="mb-3 text-sm text-muted">{t("askHint")}</p>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                // G7 R-M11-5: say so when the browser allowed it but saving the device failed.
                setTurnOnFailed(
                  (await turnOn()) === "ask" &&
                    typeof Notification !== "undefined" &&
                    Notification.permission === "granted",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("turnOn")}
          </Button>
          {turnOnFailed && (
            <p role="alert" className="mt-2 text-sm font-bold text-accent">
              {t("turnOnError")}
            </p>
          )}
        </>
      ) : state === "on" ? (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p role="status" className="text-sm font-bold text-primary">
            {t("on")}
          </p>
          <Button variant="ghost" disabled={busy} onClick={() => void turnOff()}>
            {t("turnOff")}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted">{t(`state.${state}`)}</p>
      )}
      {state === "on" && prefs && (
        <>
          {PUSH_KINDS.map((k) => (
            <Toggle
              key={k}
              label={t(`kind.${k}`)}
              hint={t(`kindHint.${k}`)}
              on={prefs[k]}
              disabled={busy}
              onChange={(on) => void update({ ...prefs, [k]: on })}
            />
          ))}
          <fieldset className="mt-2">
            <legend className="font-bold">{t("quiet")}</legend>
            <p className="mb-2 text-sm text-muted">{t("quietHint")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex min-h-11 items-center gap-2">
                <span className="text-sm">{t("quietFrom")}</span>
                <input
                  type="time"
                  className="min-h-11 rounded-xl bg-surface-2 px-3"
                  value={quiet?.start ?? prefs.quietStart ?? ""}
                  onChange={(e) =>
                    setQuiet({
                      ...{
                        start: quiet?.start ?? prefs.quietStart ?? "",
                        end: quiet?.end ?? prefs.quietEnd ?? "",
                      },
                      start: e.target.value,
                    })
                  }
                  onBlur={(e) => {
                    const v = e.target.value || null;
                    if (v !== prefs.quietStart) void update({ ...prefs, quietStart: v });
                  }}
                />
              </label>
              <label className="flex min-h-11 items-center gap-2">
                <span className="text-sm">{t("quietTo")}</span>
                <input
                  type="time"
                  className="min-h-11 rounded-xl bg-surface-2 px-3"
                  value={quiet?.end ?? prefs.quietEnd ?? ""}
                  onChange={(e) =>
                    setQuiet({
                      ...{
                        start: quiet?.start ?? prefs.quietStart ?? "",
                        end: quiet?.end ?? prefs.quietEnd ?? "",
                      },
                      end: e.target.value,
                    })
                  }
                  onBlur={(e) => {
                    const v = e.target.value || null;
                    if (v !== prefs.quietEnd) void update({ ...prefs, quietEnd: v });
                  }}
                />
              </label>
            </div>
          </fieldset>
          {saved === "error" && (
            <p role="alert" className="mt-2 text-sm font-bold text-accent">
              {t("saveError")}
            </p>
          )}
        </>
      )}
    </section>
  );
}
