"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { logEvent } from "@/lib/db/events";
import { cleanName, NAME_MAX } from "@/lib/profile/name";
import { getSupabase, getUserCached } from "@/lib/supabase/client";

/**
 * Your name (More → Account): the name friends see on your invite ("Minnie invited you").
 * Optional; nothing else in the app shows it to anyone.
 */
export function NameCard() {
  const t = useTranslations("name");
  const field = useId();
  const [name, setName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      const user = (await getUserCached()).data.user;
      if (!user) return;
      const { data } = await getSupabase()
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!live) return;
      setName((data?.display_name as string | null) ?? "");
      setLoaded(true);
    })();
    return () => {
      live = false;
    };
  }, []);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const user = (await getUserCached()).data.user;
    const value = cleanName(name);
    const { error } = user
      ? await getSupabase().from("profiles").update({ display_name: value }).eq("user_id", user.id)
      : { error: new Error("signed out") };
    if (error) setMsg({ ok: false, text: t("failed") });
    else {
      setName(value ?? "");
      setMsg({ ok: true, text: t("saved") });
      void logEvent("display_name_set", { set: value !== null });
    }
    setBusy(false);
  };

  return (
    <section
      id="name"
      aria-labelledby={`${field}-title`}
      className="mx-4 mb-3 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6"
    >
      <h2 id={`${field}-title`} className="mb-1 text-lg font-bold">
        {t("title")}
      </h2>
      <p className="mb-3 text-sm text-muted">{t("hint")}</p>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label htmlFor={field} className="sr-only">
          {t("label")}
        </label>
        <input
          id={field}
          value={name}
          maxLength={NAME_MAX}
          disabled={!loaded}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("placeholder")}
          autoComplete="nickname"
          className="min-h-11 min-w-0 flex-1 rounded-xl bg-surface-2 px-3"
        />
        <Button type="submit" variant="secondary" disabled={busy || !loaded}>
          {t("save")}
        </Button>
      </form>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className="mt-2 text-sm font-bold">
          {msg.text}
        </p>
      )}
    </section>
  );
}
