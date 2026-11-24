"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { SomArt } from "@/components/art/Som";
import { Button } from "@/components/ui/Button";
import { clearInvite, loadInvite, tokenFrom } from "@/lib/invite/token";
import { getSupabase, getUserCached } from "@/lib/supabase/client";

const OK_KEY = "247-access-ok";
type State = "checking" | "allowed" | "gated";

type Claim = "ok" | "full" | "closed" | "own" | "network";

/** Claims an invite; the server says why when it can't (G7 INV F2: the reason, not a guess). */
async function claim(token: string): Promise<Claim> {
  const { error } = await getSupabase().rpc("claim_invite", { p_token: token });
  if (!error) return "ok";
  if (error.code !== "P0001") return "network";
  return error.message === "invite full" ? "full" : error.message === "own invite" ? "own" : "closed";
}

/**
 * Invite-only (docs/FRIENDS-DESIGN.md): while Minnie's switch is on, an account that didn't join
 * through an invite (and was made after the switch) sees this instead of the app. The server
 * decides (`my_access`); once allowed, this browser remembers it for that account, so the check
 * costs nothing after the first open. A kept invite from the invite page is claimed here.
 */
export function InviteGate({ children }: { children: ReactNode }) {
  const t = useTranslations("invite");
  const router = useRouter();
  const [state, setState] = useState<State>("checking");
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  /** "unknown": the check failed. Nobody is locked out by a failed check (the server still owns
   *  every reward), but it isn't remembered either, so the next open asks again (G7 INV F5). */
  const check = async (): Promise<State | "unknown"> => {
    const { data, error } = await getSupabase().rpc("my_access");
    if (error) return "unknown";
    return (data as { allowed: boolean }).allowed ? "allowed" : "gated";
  };

  useEffect(() => {
    let live = true;
    void (async () => {
      const user = (await getUserCached()).data.user;
      let ok: string | null = null;
      try {
        ok = localStorage.getItem(OK_KEY);
      } catch {
        /* storage blocked */
      }
      const kept = loadInvite();
      if (kept) {
        const r = await claim(kept);
        if (r !== "network") clearInvite();
      }
      if (user && ok === user.id && !kept) {
        if (live) setState("allowed");
        return;
      }
      const s = await check();
      if (!live) return;
      if (s === "allowed" && user) {
        try {
          localStorage.setItem(OK_KEY, user.id);
        } catch {
          /* storage blocked */
        }
      }
      setState(s === "unknown" ? "allowed" : s);
    })();
    return () => {
      live = false;
    };
  }, []);

  // While checking, the app shows as usual: nearly everyone is allowed, and Today has its own loading.
  if (state !== "gated") return <>{children}</>;

  const join = async () => {
    const token = tokenFrom(paste);
    if (!token) {
      setMsg(t("badLink"));
      return;
    }
    setBusy(true);
    setMsg(null);
    const r = await claim(token);
    if (r === "ok" && (await check()) !== "gated") {
      setState("allowed");
    } else {
      setMsg(
        r === "network" || r === "ok"
          ? t("networkError")
          : r === "full"
            ? t("refusedFull")
            : r === "own"
              ? t("refusedOwn")
              : t("refusedClosed"),
      );
    }
    setBusy(false);
  };

  return (
    <main className="safe-top safe-bottom mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <SomArt pose="lookUp" className="h-28 w-28" />
      <h1 className="text-2xl font-extrabold">{t("gateTitle")}</h1>
      <p className="text-muted">{t("gateBody")}</p>
      <form
        className="mt-2 flex w-full flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void join();
        }}
      >
        <label htmlFor="invite-paste" className="sr-only">
          {t("pasteLabel")}
        </label>
        <input
          id="invite-paste"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder={t("pastePlaceholder")}
          className="min-h-11 w-full rounded-xl bg-surface px-3"
        />
        <Button type="submit" disabled={busy || !paste.trim()}>
          {t("join")}
        </Button>
      </form>
      {msg && (
        <p role="alert" className="text-sm font-bold text-accent">
          {msg}
        </p>
      )}
      <Button
        variant="ghost"
        onClick={async () => {
          await getSupabase().auth.signOut({ scope: "local" });
          router.replace("/login");
          router.refresh();
        }}
      >
        {t("signOut")}
      </Button>
    </main>
  );
}
