"use client";

import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AppMark } from "@/components/art/AppMark";
import { Button } from "@/components/ui/Button";
import { parseSignInInput } from "@/lib/auth/parseSignInInput";
import { getSupabase } from "@/lib/supabase/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm() {
  const t = useTranslations("login");
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") === "link" ? t("callbackError") : null,
  );

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setError(t("invalidEmail"));
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await getSupabase().auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (err) setError(t("error"));
    else {
      setEmail(trimmed);
      setStep("code");
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    const parsed = parseSignInInput(code);
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
    if (err) setError(t("invalidCode"));
    else router.replace("/today");
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex flex-col items-center text-center">
        <AppMark className="mb-4 h-20 w-20" />
        <h1 className="text-2xl font-extrabold">{t("title")}</h1>
        <p className="text-muted">{t("subtitle")}</p>
      </div>

      {step === "email" ? (
        <form onSubmit={sendCode} className="flex flex-col gap-3" noValidate>
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
          <p className="font-bold">{t("codeHint", { email })}</p>
          <p className="text-muted">{t("pasteHint")}</p>
          <label htmlFor="code" className="font-bold">
            {t("codeLabel")}
          </label>
          <textarea
            id="code"
            rows={3}
            autoComplete="one-time-code"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder={t("pastePlaceholder")}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="min-h-12 rounded-xl border border-line bg-surface px-4 py-3 text-base break-all"
          />
          <Button type="submit" disabled={busy || code.trim().length < 6}>
            {busy ? t("verifying") : t("verify")}
          </Button>
          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep("email")}>
              {t("changeEmail")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => sendCode()} disabled={busy}>
              {t("resend")}
            </Button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-accent-soft p-3 text-accent">
          {error}
        </p>
      )}
    </div>
  );
}
