"use client";

import { useTranslations } from "next-intl";
import type { DayCapacity } from "@/lib/backlog";
import { useDuration } from "./useDuration";

/** RCCP-style bar: planned estimates vs free minutes; turns red (warn) when overloaded. */
export function CapacityBar({ cap }: { cap: DayCapacity }) {
  const t = useTranslations("backlog");
  const dur = useDuration();
  const pct = cap.capacityMin === 0 ? 100 : Math.min(100, Math.round((cap.loadMin / cap.capacityMin) * 100));
  return (
    <div className="flex flex-col gap-1">
      <div aria-hidden="true" className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full ${cap.overloaded ? "bg-warn" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={`text-xs ${cap.overloaded ? "font-bold text-warn" : "text-muted"}`}>
        {cap.overloaded
          ? t("over", { over: dur(cap.loadMin - cap.capacityMin) })
          : t("capacity", { load: dur(cap.loadMin), capacity: dur(cap.capacityMin) })}
        {cap.unestimated > 0 && ` · ${t("unestimated", { count: cap.unestimated })}`}
      </p>
    </div>
  );
}
