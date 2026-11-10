"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { TicketArt } from "@/components/art/Ticket";
import { ChevronIcon } from "@/components/ui/Icons";
import type { ReviewStatus } from "@/lib/stats/useStats";
import { getSupabase } from "@/lib/supabase/client";

/** Today's quiet nudge on Sunday (and the Monday after): the weekly review is open, +3 tickets. */
export function TodayReviewLine() {
  const t = useTranslations("stats.review");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await getSupabase().rpc("weekly_review_status");
      if (cancelled || error || !data) return;
      const s = data as ReviewStatus;
      setOpen(s.week_start !== null && !s.done);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  if (!open) return null;
  return (
    <Link
      href="/stats"
      className="tap mx-4 mb-3 flex min-h-11 items-center gap-2 rounded-xl bg-primary-soft px-3 text-sm font-bold text-primary lg:mx-6"
    >
      <TicketArt className="h-6 w-9 shrink-0" kind="night" />
      <span className="min-w-0 flex-1">{t("todayLine")}</span>
      <ChevronIcon className="h-4 w-4 -rotate-90" />
    </Link>
  );
}
