"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { getSupabase } from "@/lib/supabase/client";

/**
 * Delete my account (M14 / G15, Minnie OK 2026-11-16): two steps, then the server deletes the
 * user and every row they own (`delete_my_account`), and the app signs out to the login screen.
 */
export function DeleteAccount() {
  const t = useTranslations("more.delete");
  const [step, setStep] = useState<"idle" | "confirm" | "working" | "error">("idle");
  if (step === "idle")
    return (
      <Button variant="ghost" onClick={() => setStep("confirm")} className="mt-2 text-accent">
        {t("open")}
      </Button>
    );
  return (
    <div role="alertdialog" aria-label={t("title")} className="mt-3 rounded-xl bg-surface-2 p-3">
      <p className="mb-1 font-bold">{t("title")}</p>
      <p className="mb-3 text-sm text-muted">{t("body")}</p>
      {step === "error" && (
        <p role="alert" className="mb-2 text-sm font-bold text-accent">
          {t("error")}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={step === "working"}
          className="bg-accent text-on-primary"
          onClick={async () => {
            setStep("working");
            const client = getSupabase();
            const { error } = await client.rpc("delete_my_account");
            if (error) {
              setStep("error");
              return;
            }
            await client.auth.signOut({ scope: "local" });
            window.location.replace(new URL("/login", window.location.origin).href);
          }}
        >
          {t("confirm")}
        </Button>
        <Button variant="ghost" disabled={step === "working"} onClick={() => setStep("idle")}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
