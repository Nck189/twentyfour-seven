"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { getSupabase, getUserCached } from "@/lib/supabase/client";

type Status = {
  token: string;
  active: boolean;
  quota: number | null;
  /** Friends who ever joined through it (a deleted account doesn't give its place back). */
  used: number;
  joined: { name: string | null; paid: boolean }[];
};

/**
 * Invite a friend (docs/FRIENDS-DESIGN.md): one personal link with room for 2 (Minnie's has no
 * limit). When a friend finishes their first lived day, both get a capsule ticket; the server pays.
 */
export function InviteCard() {
  const t = useTranslations("invite");
  const tc = useTranslations("common");
  const [s, setS] = useState<Status | null | "error" | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [noName, setNoName] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await getSupabase().rpc("invite_status");
    setS(error ? "error" : ((data as Status | null) ?? null));
  }, []);
  useEffect(() => {
    let live = true;
    void getUserCached().then(async ({ data }) => {
      if (!data.user) return;
      const p = await getSupabase()
        .from("profiles")
        .select("display_name")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (live && !p.error) setNoName(!((p.data?.display_name as string | null) ?? "").trim());
    });
    void getSupabase()
      .rpc("invite_status")
      .then(({ data, error }) => {
        if (live) setS(error ? "error" : ((data as Status | null) ?? null));
      });
    return () => {
      live = false;
    };
  }, []);

  const make = async (fresh: boolean) => {
    setBusy(true);
    setMsg(null);
    const { error } = await getSupabase().rpc("create_invite_link", { p_new: fresh });
    if (error) setMsg({ ok: false, text: t("makeFailed") });
    await load();
    setBusy(false);
  };

  const url = s && s !== "error" ? `${window.location.origin}/i/${s.token}` : null;
  const left = s && s !== "error" && s.quota !== null ? Math.max(0, s.quota - s.used) : null;

  return (
    <section
      id="invite"
      aria-labelledby="invite-title"
      className="mx-4 mb-3 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6"
    >
      <h2 id="invite-title" className="mb-1 text-lg font-bold">
        {t("cardTitle")}
      </h2>
      <p className="mb-1 text-sm text-muted">{t("cardHint")}</p>
      <p className="mb-3 text-xs text-muted">{t("privacy")}</p>
      {/* No name yet: the invite would say "A friend invited you". */}
      {noName && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <p>{t("noName")}</p>
          <Link
            href="/more/account#name"
            className="tap inline-flex min-h-11 items-center rounded-xl bg-primary-soft px-3 font-bold text-primary"
          >
            {t("addName")}
          </Link>
        </div>
      )}
      {s === undefined ? (
        <p role="status" className="text-sm text-muted">
          {tc("loading")}
        </p>
      ) : s === "error" ? (
        <div className="flex flex-wrap items-center gap-2">
          <p role="alert" className="text-sm font-bold">
            {t("loadError")}
          </p>
          <Button variant="secondary" onClick={() => void load()}>
            {tc("retry")}
          </Button>
        </div>
      ) : !url ? (
        <Button variant="secondary" disabled={busy} onClick={() => void make(false)}>
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
          <p className="mb-2 text-sm font-bold">{left === null ? t("unlimited") : t("left", { n: left })}</p>
          <div className="mb-2 flex flex-wrap gap-2">
            <Button
              disabled={left === 0}
              onClick={() =>
                (navigator.clipboard?.writeText(url) ?? Promise.reject(new Error("no clipboard"))).then(
                  () => setMsg({ ok: true, text: t("copied") }),
                  () => setMsg({ ok: false, text: t("copyFailed") }),
                )
              }
            >
              {t("copy")}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => void make(true)}>
              {t("newLink")}
            </Button>
          </div>
          {s && s.joined.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm" aria-label={t("joinedLabel")}>
              {s.joined.map((j, i) => (
                <li key={i}>{(j.name ?? t("aFriend")) + " · " + (j.paid ? t("paid") : t("waiting"))}</li>
              ))}
            </ul>
          )}
        </>
      )}
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className="mt-2 text-sm font-bold">
          {msg.text}
        </p>
      )}
    </section>
  );
}
