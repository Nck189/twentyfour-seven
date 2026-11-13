"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { freeDaysFromContext } from "@/lib/share/compute";
import { slotsText, type DayFree } from "@/lib/share/freebusy";
import { getSupabase } from "@/lib/supabase/client";
import { loadDayContext } from "@/lib/today/loadContext";

type Request = {
  id: string;
  day: string;
  start_at: string;
  end_at: string;
  name: string;
  note: string;
  status: "pending" | "accepted" | "declined";
};

/**
 * More → Share my free time (M12, SPEC §9): a private link (free/busy only, the next 2 weeks),
 * "Copy free times" as text or an image for LINE, and the requests inbox (accept → a fixed event in
 * that day's plan; decline). The link can be replaced; the old one stops working.
 */
export function ShareCard() {
  const t = useTranslations("share");
  const locale = useLocale();
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [requests, setRequests] = useState<Request[] | null>(null);
  const [tz, setTz] = useState("Asia/Bangkok");

  const [tick, setTick] = useState(0);
  const loadRequests = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await getSupabase()
        .from("booking_requests")
        .select("id, day, start_at, end_at, name, note, status")
        .order("created_at", { ascending: false })
        .limit(20);
      if (!cancelled && !r.error) setRequests(r.data as Request[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const time = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }),
    [locale, tz],
  );
  const dayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }),
    [locale],
  );

  const freeDays = async (): Promise<DayFree[]> => {
    const { ctx } = await loadDayContext(getSupabase(), -2, 15);
    setTz(ctx.timezone);
    return freeDaysFromContext(ctx, new Date());
  };
  const text = (days: DayFree[]) =>
    slotsText(days, {
      title: t("copyTitle"),
      none: t("none"),
      day: (d) => dayLabel.format(new Date(`${d}T00:00:00Z`)),
      time: (d) => time.format(d),
    });

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setMsg(null);
    try {
      setMsg({ kind: "ok", text: await fn() });
    } catch {
      setMsg({ kind: "error", text: t("error") });
    } finally {
      setBusy(false);
    }
  };

  const pending = (requests ?? []).filter((r) => r.status === "pending");
  const answered = (requests ?? []).filter((r) => r.status !== "pending").slice(0, 5);

  return (
    <section id="share" className="mx-4 mb-3 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6">
      <h2 className="mb-1 text-lg font-bold">{t("cardTitle")}</h2>
      <p className="mb-3 text-sm text-muted">{t("cardHint")}</p>

      {!url ? (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const r = await getSupabase().rpc("share_link", { p_rotate: false });
              if (r.error || typeof r.data !== "string") throw r.error;
              setUrl(`${window.location.origin}/share/${r.data}`);
              return t("linkReady");
            })
          }
        >
          {t("getLink")}
        </Button>
      ) : (
        <>
          <input
            readOnly
            aria-label={t("linkLabel")}
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="mb-2 min-h-11 w-full rounded-xl bg-surface-2 px-3 text-sm"
          />
          <div className="mb-2 flex flex-wrap gap-2">
            <Button
              onClick={() =>
                run(async () => {
                  await navigator.clipboard.writeText(url);
                  return t("copied");
                })
              }
            >
              {t("copyLink")}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const r = await getSupabase().rpc("share_link", { p_rotate: true });
                  if (r.error || typeof r.data !== "string") throw r.error;
                  setUrl(`${window.location.origin}/share/${r.data}`);
                  return t("rotated");
                })
              }
            >
              {t("newLink")}
            </Button>
          </div>
        </>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await navigator.clipboard.writeText(text(await freeDays()));
              return t("copiedSlots");
            })
          }
        >
          {t("copySlots")}
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const blob = await slotsImage(text(await freeDays()));
              const file = new File([blob], "free-times.png", { type: "image/png" });
              if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
              else {
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "free-times.png";
                a.click();
                URL.revokeObjectURL(a.href);
              }
              return t("imageReady");
            })
          }
        >
          {t("slotsImage")}
        </Button>
      </div>
      {msg && (
        <p
          role={msg.kind === "error" ? "alert" : "status"}
          className={`mt-2 text-sm font-bold ${msg.kind === "error" ? "text-accent" : "text-primary"}`}
        >
          {msg.text}
        </p>
      )}

      <h3 className="mt-4 mb-2 font-bold">{t("inbox", { n: pending.length })}</h3>
      {requests && pending.length === 0 && <p className="text-sm text-muted">{t("inboxEmpty")}</p>}
      <ul className="flex flex-col gap-2">
        {pending.map((r) => (
          <li key={r.id} className="rounded-xl bg-surface-2 p-3">
            <p className="font-bold">
              {r.name} · {dayLabel.format(new Date(`${r.day}T00:00:00Z`))} {time.format(new Date(r.start_at))}
              –{time.format(new Date(r.end_at))}
            </p>
            {r.note && <p className="text-sm text-muted">{r.note}</p>}
            <div className="mt-2 flex gap-2">
              <Button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const x = await getSupabase().rpc("answer_booking", { p_id: r.id, p_accept: true });
                    if (x.error) throw x.error;
                    loadRequests();
                    return t("accepted", { name: r.name });
                  })
                }
              >
                {t("accept")}
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const x = await getSupabase().rpc("answer_booking", { p_id: r.id, p_accept: false });
                    if (x.error) throw x.error;
                    loadRequests();
                    return t("declined", { name: r.name });
                  })
                }
              >
                {t("decline")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {answered.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
          {answered.map((r) => (
            <li key={r.id}>
              {r.name} · {dayLabel.format(new Date(`${r.day}T00:00:00Z`))} {time.format(new Date(r.start_at))}{" "}
              · {t(`status.${r.status}`)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The free times as a small PNG for LINE: the app's own colors, rounded, no black. */
async function slotsImage(text: string): Promise<Blob> {
  const css = getComputedStyle(document.documentElement);
  // The UI tokens (styles/tokens.css), so the picture matches the app in light and dark mode.
  const bg = css.getPropertyValue("--ui-bg").trim();
  const card = css.getPropertyValue("--ui-surface").trim();
  const ink = css.getPropertyValue("--ui-text").trim();
  const accent = css.getPropertyValue("--ui-primary").trim();
  const font = getComputedStyle(document.body).fontFamily;
  const lines = text.split("\n");
  const scale = 2;
  const w = 720;
  const lh = 44;
  const h = 80 + lines.length * lh;
  const c = document.createElement("canvas");
  c.width = w * scale;
  c.height = h * scale;
  const g = c.getContext("2d")!;
  g.scale(scale, scale);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = card;
  g.beginPath();
  g.roundRect(20, 20, w - 40, h - 40, 24);
  g.fill();
  lines.forEach((l, i) => {
    g.fillStyle = i === 0 ? accent : ink;
    g.font = `${i === 0 ? "700 28px" : "500 22px"} ${font}`;
    g.fillText(l, 48, 70 + i * lh, w - 96);
  });
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("no image"))), "image/png"));
}
