"use client";

import { useTranslations } from "next-intl";

/** "2h 30m" / "2 ชม. 30 น." from minutes. */
export function useDuration() {
  const t = useTranslations("backlog.duration");
  return (minutes: number) => {
    const h = Math.floor(Math.abs(minutes) / 60);
    const m = Math.abs(minutes) % 60;
    if (h && m) return t("hm", { h, m });
    if (h) return t("h", { h });
    return t("m", { m });
  };
}
