"use client";

import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { AppMark } from "@/components/art/AppMark";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { parseSignInInput } from "@/lib/auth/parseSignInInput";
import type { Locale } from "@/lib/i18n/config";
import { usePrefs } from "@/lib/store/prefs";
import { getSupabase } from "@/lib/supabase/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN_S = 60;
/** The paste step is saved so it survives iOS reloading the PWA while the user is in Mail. */
const PENDING_KEY = "247-login-pending";
const PENDING_TTL_MS = 60 * 60 * 1000;

type Pending = { email: string; sentAt: number };

const PENDING_EVENT = "247-login-pending-change";

function readPendingRaw(): string | null {
  try {
    return localStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

function writePending(p: Pending | null) {
  try {
    if (p) localStorage.setItem(PENDING_KEY, JSON.stringify(p));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    // Storage unavailable: the step just won't survive a reload.
  }
  window.dispatchEvent(new Event(PENDING_EVENT));
}

function subscribePending(cb: () => void) {
  window.addEventListener(PENDING_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(PENDING_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Called from event handlers only. */
function makePending(email: string): Pending {
  return { email, sentAt: new Date().getTime() };
}

function parsePending(raw: string | null, now: number): Pending | null {
  try {
    const p = JSON.parse(raw ?? "null") as Pending | null;
    return p && now - p.sentAt < PENDING_TTL_MS ? p : null;
  } catch {
    return null;
  }
}

export function LoginForm() {
  const t = useTranslations("login");
  const router = useRouter();
  const params = useSearchParams();
  const { locale, setLocale } = usePrefs();
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const pendingRaw = useSyncExternalStore(subscribePending, readPendingRaw, () => null);
  const [now, setNow] = useState(() => Date.now());
  const pending = parsePending(pendingRaw, now);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    params.get("error") === "link" ? t("callbackError") : null,
  );

  // Resend countdown tick.
  const secondsLeft = pending
    ? Math.max(0, RESEND_COOLDOWN_S - Math.floor((now - pending.sentAt) / 1000))
    : 0;
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  async function sendLink(e?: FormEvent, isResend = false) {
    e?.preventDefault();
    const trimmed = (isResend && pending ? pending.email : email).trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setError(t("invalidEmail"));
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    const { error: err } = await getSupabase().auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (err) {
      setError(err.status === 429 ? t("rateLimited") : t("error"));
      return;
    }
    const p = makePending(trimmed);
    setEmail(trimmed);
    setNow(p.sentAt);
    writePending(p);
    if (isResend) setStatus(t("resent"));
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    const parsed = parseSignInInput(link);
    if (parsed.kind === "invalid") {
      setError(t("invalidCode"));
      return;
    }
    setBusy(true);
    setError(null);
    const auth = getSupabase().auth;
    const { error: err } =
      parsed.kind === "code"
        ? await auth.verifyOtp({ email, token: parsed.code, type: "email" })
        : await auth.verifyOtp({ token_hash: parsed.tokenHash, type: parsed.type });
    setBusy(false);
    if (err) {
      setError(t("invalidCode"));
      return;
    }
    writePending(null);
    router.replace("/today");
  }

  function changeEmail() {
    writePending(null);
    setLink("");
    setStatus(null);
    setError(null);
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex justify-end">
        <div className="w-40">
          <Segmented<Locale>
            compact
            label={t("language")}
            value={locale}
            onChange={setLocale}
            options={[
              { value: "en", label: "EN" },
              { value: "th", label: "ไทย" },
            ]}
          />
        </div>
      </div>
      <div className="mb-6 flex flex-col items-center text-center">
        <AppMark className="mb-4 h-20 w-20" />
        <h1 className="text-2xl font-extrabold">{t("title")}</h1>
        <p className="text-muted">{t("subtitle")}</p>
      </div>

      {!pending ? (
        <form onSubmit={(e) => sendLink(e)} className="flex flex-col gap-3" noValidate>
          <label htmlFor="email" className="font-bold">
            {t("emailLabel")}
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-12 rounded-xl border border-line bg-surface px-4 text-base"
          />
          <Button type="submit" disabled={busy}>
            {busy ? t("sending") : t("send")}
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-3">
          <p className="font-bold">{t("codeHint", { email: pending.email })}</p>
          <p role="note" className="rounded-xl bg-warn-soft p-3 font-bold text-warn">
            {t("dontTap")}
          </p>
          <p className="text-muted">{t("pasteHint")}</p>
          <label htmlFor="link" className="font-bold">
            {t("codeLabel")}
          </label>
          <textarea
            id="link"
            rows={3}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder={t("pastePlaceholder")}
            value={link}
            onChange={(e) => setLink(e.target.value)}
            className="min-h-12 rounded-xl border border-line bg-surface px-4 py-3 text-base break-all"
          />
          <Button type="submit" disabled={busy || link.trim().length < 6}>
            {busy ? t("verifying") : t("verify")}
          </Button>
          <div className="flex flex-wrap justify-between gap-2">
            <Button type="button" variant="ghost" onClick={changeEmail}>
              {t("changeEmail")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => sendLink(undefined, true)}
              disabled={busy || secondsLeft > 0}
            >
              {secondsLeft > 0 ? t("resendIn", { seconds: secondsLeft }) : t("resend")}
            </Button>
          </div>
        </form>
      )}

      <p
        role="status"
        aria-live="polite"
        className={status ? "mt-4 rounded-xl bg-primary-soft p-3 text-primary" : "sr-only"}
      >
        {status ?? ""}
      </p>
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-accent-soft p-3 text-accent">
          {error}
        </p>
      )}
    </div>
  );
}
