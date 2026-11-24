"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { SomArt } from "@/components/art/Som";
import { saveInvite } from "@/lib/invite/token";
import { getSupabase } from "@/lib/supabase/client";

type Preview = { name: string | null; open: boolean } | null | "error";

/**
 * The invite page: whose invite it is, and a way in. The token is kept in this browser so the new
 * account claims it after signing in (components/invite/InviteGate.tsx); the server decides.
 */
export function InviteLanding({ token }: { token: string }) {
  const t = useTranslations("invite");
  const [preview, setPreview] = useState<Preview | undefined>(undefined);

  useEffect(() => {
    let live = true;
    void getSupabase()
      .rpc("invite_preview", { p_token: token })
      .then(({ data, error }) => {
        if (!live) return;
        const p: Preview = error ? "error" : ((data as Preview) ?? null);
        setPreview(p);
        if (p && p !== "error" && p.open) saveInvite(token);
      });
    return () => {
      live = false;
    };
  }, [token]);

  return (
    <main className="safe-top safe-bottom mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <SomArt pose={preview && preview !== "error" && preview.open ? "happy" : "sit"} className="h-28 w-28" />
      {preview === undefined ? (
        <p role="status" className="text-muted">
          {t("checking")}
        </p>
      ) : preview === "error" ? (
        <>
          <h1 className="text-2xl font-extrabold">{t("checkFailed")}</h1>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="tap mt-2 inline-flex min-h-11 items-center justify-center rounded-xl bg-surface-2 px-5 font-bold text-ink"
          >
            {t("retry")}
          </button>
        </>
      ) : preview?.open ? (
        <>
          <h1 className="text-2xl font-extrabold break-words [overflow-wrap:anywhere]">
            {preview.name ? t("fromName", { name: preview.name }) : t("fromFriend")}
          </h1>
          <p className="text-muted">{t("landingBody")}</p>
          <Link
            href="/login"
            className="tap mt-2 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 font-bold text-on-primary"
          >
            {t("start")}
          </Link>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-extrabold">{t("closedTitle")}</h1>
          <p className="text-muted">{t("closedBody")}</p>
          <Link
            href="/"
            className="tap mt-2 inline-flex min-h-11 items-center justify-center rounded-xl bg-surface-2 px-5 font-bold text-ink"
          >
            {t("aboutApp")}
          </Link>
        </>
      )}
    </main>
  );
}
