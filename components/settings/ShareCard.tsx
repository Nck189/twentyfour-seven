"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { freeDaysFromContext } from "@/lib/share/compute";
import { slotFits, slotsText, type DayFree } from "@/lib/share/freebusy";
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
 * that day's plan; decline). The link can be replaced or turned off; the old one stops working.
 */
export function ShareCard() {
  const t = useTranslations("share");
  const locale = useLocale();
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState<Request[] | null>(null);
  const [answered, setAnswered] = useState<Request[]>([]);
  // Loaded up front so Copy / Share run inside the tap (iOS drops the gesture across a network
  // wait; G7 R-M12-5), and inbox times use the profile timezone from the start (R-M12-9).
  const [days, setDays] = useState<DayFree[] | null>(null);
  const [tz, setTz] = useState<string | null>(null);
  const [image, setImage] = useState<File | null>(null);
  /** When the inbox was loaded (whether a request's time has passed). */
  const [now, setNow] = useState(0);

  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    let cancelled = false;
    const db = getSupabase();
    void (async () => {
      const [link, open, done, ctx] = await Promise.all([
        db.from("share_links").select("token").maybeSingle(),
        // Every pending request (spam can't push a real one out of view; R-M12-8).
        db
          .from("booking_requests")
          .select("id, day, start_at, end_at, name, note, status")
          .eq("status", "pending")
          .order("start_at"),
        db
          .from("booking_requests")
          .select("id, day, start_at, end_at, name, note, status")
          .neq("status", "pending")
          .order("answered_at", { ascending: false })
          .limit(5),
        loadDayContext(db, -2, 15).catch(() => null),
      ]);
      if (cancelled) return;
      setNow(Date.now());
      if (!link.error) setUrl(link.data ? `${window.location.origin}/share/${link.data.token}` : null);
      if (!open.error) setPending(open.data as Request[]);
      if (!done.error) setAnswered(done.data as Request[]);
      if (ctx) {
        setTz(ctx.ctx.timezone);
        setDays(freeDaysFromContext(ctx.ctx, new Date()));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const zone = tz ?? "Asia/Bangkok";
  const time = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { timeZone: zone, hour: "2-digit", minute: "2-digit", hour12: false }),
    [locale, zone],
  );
  const dayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }),
    [locale],
  );
  const text = useMemo(
    () =>
      days && tz
        ? slotsText(days, {
            title: t("copyTitleTz", { tz }),
            none: t("none"),
            day: (d) => dayLabel.format(new Date(`${d}T00:00:00Z`)),
            time: (d) => time.format(d),
          })
        : null,
    [days, tz, t, dayLabel, time],
  );
  // The picture is drawn ahead of the tap too.
  useEffect(() => {
    let cancelled = false;
    if (!text) return;
    void slotsImage(text)
      .then((blob) => {
        if (!cancelled) setImage(new File([blob], "free-times.png", { type: "image/png" }));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [text]);

  const run = async (fn: () => Promise<string>, fail = t("failed")) => {
    setBusy(true);
    setMsg(null);
    try {
      setMsg({ kind: "ok", text: await fn() });
    } catch {
      setMsg({ kind: "error", text: fail });
    } finally {
      setBusy(false);
    }
  };
  /** Starts the clipboard / share call synchronously inside the tap, then reports. */
  const report = (p: Promise<unknown>, ok: string, fail: string) => {
    setMsg(null);
    p.then(
      () => setMsg({ kind: "ok", text: ok }),
      (e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return; // closed the share sheet
        setMsg({ kind: "error", text: fail });
      },
    );
  };
  const link = (rotate: boolean) =>
    run(async () => {
      const r = await getSupabase().rpc("share_link", { p_rotate: rotate });
      if (r.error || typeof r.data !== "string") throw r.error;
      setUrl(`${window.location.origin}/share/${r.data}`);
      return rotate ? t("rotated") : t("linkReady");
    });
  const answer = (r: Request, accept: boolean) =>
    run(async () => {
      const x = await getSupabase().rpc("answer_booking", { p_id: r.id, p_accept: accept });
      if (x.error) throw x.error;
      reload();
      return accept ? t("accepted", { name: r.name }) : t("declined", { name: r.name });
    });
  /** Why a pending request can't be accepted any more (it would re-flow the day; R-M12-4/-7). */
  const blocked = (r: Request): "past" | "notFree" | null => {
    const s = new Date(r.start_at);
    const e = new Date(r.end_at);
    if (e.getTime() <= now) return "past";
    if (days && s.getTime() > now && !slotFits(days, s, e)) return "notFree";
    return null;
  };

  return (
    <section id="share" className="mx-4 mb-3 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6">
      <h2 className="mb-1 text-lg font-bold">{t("cardTitle")}</h2>
      <p className="mb-3 text-sm text-muted">{t("cardHint")}</p>

      {!url ? (
        // Waits for the first load, which would otherwise overwrite a link made meanwhile.
        <Button variant="secondary" disabled={busy || pending === null} onClick={() => link(false)}>
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
            <Button onClick={() => report(navigator.clipboard.writeText(url), t("copied"), t("copyFailed"))}>
              {t("copyLink")}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => link(true)}>
              {t("newLink")}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const r = await getSupabase().rpc("share_link_off");
                  if (r.error) throw r.error;
                  setUrl(null);
                  return t("stopped");
                })
              }
            >
              {t("stop")}
            </Button>
          </div>
        </>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={!text}
          onClick={() =>
            text && report(navigator.clipboard.writeText(text), t("copiedSlots"), t("copyFailed"))
          }
        >
          {t("copySlots")}
        </Button>
        <Button
          variant="secondary"
          disabled={!image}
          onClick={() => {
            if (!image) return;
            if (navigator.canShare?.({ files: [image] }))
              report(navigator.share({ files: [image] }), t("imageReady"), t("failed"));
            else {
              const a = document.createElement("a");
              a.href = URL.createObjectURL(image);
              a.download = image.name;
              a.click();
              URL.revokeObjectURL(a.href);
              setMsg({ kind: "ok", text: t("imageReady") });
            }
          }}
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

      <h3 className="mt-4 mb-2 font-bold">{t("inbox", { n: pending?.length ?? 0 })}</h3>
      {pending && pending.length === 0 && <p className="text-sm text-muted">{t("inboxEmpty")}</p>}
      <ul className="flex flex-col gap-2">
        {(pending ?? []).map((r) => {
          const why = blocked(r);
          return (
            <li key={r.id} className="rounded-xl bg-surface-2 p-3">
              <p className="font-bold">
                {r.name} · {dayLabel.format(new Date(`${r.day}T00:00:00Z`))}{" "}
                {time.format(new Date(r.start_at))}–{time.format(new Date(r.end_at))}
              </p>
              {r.note && <p className="text-sm whitespace-pre-line text-muted">{r.note}</p>}
              {why && (
                <p className="text-sm font-bold text-accent">{t(why === "past" ? "past" : "noLongerFree")}</p>
              )}
              <div className="mt-2 flex gap-2">
                {!why && (
                  <Button
                    disabled={busy}
                    aria-label={t("acceptName", { name: r.name })}
                    onClick={() => answer(r, true)}
                  >
                    {t("accept")}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  disabled={busy}
                  aria-label={t("declineName", { name: r.name })}
                  onClick={() => answer(r, false)}
                >
                  {t("decline")}
                </Button>
              </div>
            </li>
          );
        })}
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
