"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ActualPrompt } from "@/components/backlog/ActualPrompt";
import { BacklogList } from "@/components/backlog/BacklogList";
import { useBacklog } from "@/lib/backlog/useBacklog";
import { usePlan } from "@/lib/plan/usePlan";

/**
 * The backlog in the iPad/Mac side panel while the main column is the farm (it used to be a
 * "coming soon" placeholder left from M0). Capture, tick and the estimate question work here;
 * opening a task goes to Plan, where its full sheet (schedule, Move to…) lives.
 */
export function SideBacklog() {
  const tc = useTranslations("common");
  const router = useRouter();
  const plan = usePlan();
  const backlog = useBacklog(plan.userId);
  const [asking, setAsking] = useState<string | null>(null);
  const askItem = backlog.items.find((i) => i.id === asking);

  return (
    // The list carries its own "Backlog" heading, so the panel adds only the top spacing.
    <div className="pt-6">
      {!plan.today || !plan.ctx ? (
        <p role="status" className="mx-4 text-muted lg:mx-6">
          {plan.status === "error" ? tc("error") : tc("loading")}
        </p>
      ) : (
        <BacklogList
          items={backlog.items}
          today={plan.today}
          timezone={plan.ctx.timezone}
          error={backlog.error}
          loadState={backlog.status}
          onRetry={backlog.reload}
          onAdd={async (c) => {
            if (c.appointment) {
              await plan.addAppointment(c.appointment.date, c.title, c.appointment.start, c.appointment.end);
              return true;
            }
            return backlog.add(c);
          }}
          onOpen={() => router.push("/plan")}
          onComplete={async (id) => {
            const coins = await backlog.complete(id);
            const it = backlog.items.find((i) => i.id === id);
            if (coins !== null && (it?.estimate_min ?? 0) > 0) setAsking(id);
            return coins;
          }}
        />
      )}
      {askItem && (askItem.estimate_min ?? 0) > 0 && (
        <ActualPrompt
          item={askItem as typeof askItem & { estimate_min: number }}
          onPick={(min) => {
            setAsking(null);
            void backlog.update(askItem.id, { actual_min: min });
          }}
          onSkip={() => setAsking(null)}
        />
      )}
    </div>
  );
}
