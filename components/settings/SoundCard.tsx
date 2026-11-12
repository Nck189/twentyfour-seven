"use client";

import { useTranslations } from "next-intl";
import { usePrefs } from "@/lib/store/prefs";
import { getSupabase } from "@/lib/supabase/client";

function Toggle({
  label,
  hint,
  on,
  onChange,
  disabled = false,
}: {
  label: string;
  hint?: string;
  on: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="tap flex min-h-11 w-full items-center gap-3 rounded-xl py-2 text-left disabled:opacity-50"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
      <span
        aria-hidden="true"
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-primary" : "bg-line"}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-surface transition-[left] ${on ? "left-6" : "left-1"}`}
        />
      </span>
    </button>
  );
}

/**
 * Sound & motion (CLAUDE.md: every sound has a mute, plus a "skip animation" setting): the global
 * mute (also saved to the profile, so other devices follow), auto-quiet during Focus and Work,
 * and skip animations. Reduced motion in the OS is always respected on top of this.
 */
export function SoundCard() {
  const t = useTranslations("more");
  const { soundOn, setSoundOn, autoQuiet, setAutoQuiet, skipAnimations, setSkipAnimations } = usePrefs();
  const changeSound = (on: boolean) => {
    setSoundOn(on);
    void (async () => {
      const client = getSupabase();
      const { data } = await client.auth.getUser();
      if (data.user) await client.from("profiles").update({ sound_on: on }).eq("user_id", data.user.id);
    })();
  };
  return (
    <section id="sound" className="mx-4 mb-3 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6">
      <h2 className="mb-2 text-lg font-bold">{t("soundTitle")}</h2>
      <Toggle label={t("soundOn")} on={soundOn} onChange={changeSound} />
      <Toggle
        label={t("autoQuiet")}
        hint={t("autoQuietHint")}
        on={autoQuiet ?? true}
        onChange={setAutoQuiet}
        disabled={!soundOn}
      />
      <Toggle
        label={t("skipAnimations")}
        hint={t("skipAnimationsHint")}
        on={skipAnimations}
        onChange={setSkipAnimations}
      />
    </section>
  );
}
