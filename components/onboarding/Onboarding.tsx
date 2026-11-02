"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckIcon } from "@/components/ui/Icons";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { useSetup } from "@/lib/onboarding/useSetup";
import type { TemplateRow } from "@/lib/today/day";
import { First10Step } from "./First10Step";
import { SleepStep } from "./SleepStep";

const STEPS = ["sleep", "first10", "done"] as const;
type Step = (typeof STEPS)[number];

/**
 * First-run setup (2 short steps + done, every step skippable). Also opened from More with
 * `?step=sleep|first10&from=more` to edit later; then finishing goes back to More.
 */
export function Onboarding() {
  const t = useTranslations("onboarding");
  const tc = useTranslations("common");
  const tt = useTranslations("templates");
  const router = useRouter();
  const params = useSearchParams();
  const fromMore = params.get("from") === "more";
  const asked = params.get("step") as Step | null;
  const [step, setStep] = useState<Step>(asked && STEPS.includes(asked) ? asked : "sleep");
  const setup = useSetup();

  const leave = () => router.push(fromMore ? "/more" : "/today");
  async function skip() {
    if (!fromMore && !setup.onboarding?.done) await setup.finish("skipped");
    leave();
  }
  async function done() {
    await setup.finish("done");
    if (fromMore) leave();
    else setStep("done");
  }
  const nameOf = (x: TemplateRow) => x.name ?? tt(x.key as Parameters<typeof tt>[0]);
  const index = STEPS.indexOf(step);

  return (
    <>
      <ScreenHeader
        title={t("title")}
        action={
          step !== "done" && (
            <Button variant="ghost" onClick={() => void skip()}>
              {fromMore ? tc("close") : t("skip")}
            </Button>
          )
        }
      />
      {!fromMore && (
        <div className="mx-4 mb-4 flex items-center gap-1.5 lg:mx-6">
          <span className="sr-only">{`${index + 1} / ${STEPS.length}`}</span>
          {STEPS.map((s, i) => (
            <span
              key={s}
              aria-hidden="true"
              className={`h-2 rounded-full ${i === index ? "w-6 bg-primary" : i < index ? "w-2 bg-primary" : "w-2 bg-surface-2"}`}
            />
          ))}
        </div>
      )}
      <div className="mx-4 mb-8 flex flex-col gap-4 lg:mx-6">
        {setup.status === "loading" && (
          <p role="status" className="text-muted">
            {tc("loading")}
          </p>
        )}
        {setup.status === "error" && (
          <p role="alert" className="rounded-xl bg-accent-soft p-3 text-accent">
            {tc("error")}
          </p>
        )}
        {setup.error && (
          <p role="alert" className="rounded-xl bg-accent-soft p-3 text-sm text-accent">
            {tc("error")}
          </p>
        )}
        {setup.status === "ready" && step === "sleep" && (
          <>
            <SleepStep
              templates={setup.templates}
              nameOf={nameOf}
              onSleep={setup.setSleep}
              onMoveDay={(d, id) => void setup.moveWeekday(d, id)}
            />
            <Button onClick={() => (fromMore ? leave() : setStep("first10"))}>
              {fromMore ? t("finish") : t("next")}
            </Button>
          </>
        )}
        {setup.status === "ready" && step === "first10" && (
          <>
            <First10Step
              blocks={setup.blocks}
              onPick={(k, v) => void setup.setFirst10(k, v)}
              onAddOwn={setup.addOwnFirst10}
              onUseFirst10={(on) => void setup.setUseFirst10(on)}
              onDone={() => void done()}
            />
            <div className="flex gap-2">
              {!fromMore && (
                <Button variant="secondary" onClick={() => setStep("sleep")}>
                  {t("back")}
                </Button>
              )}
              <Button className="flex-1" onClick={() => void done()}>
                {t("finish")}
              </Button>
            </div>
          </>
        )}
        {step === "done" && (
          <section className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-primary">
              <CheckIcon className="h-8 w-8" />
            </span>
            <h2 className="text-xl font-extrabold">{t("doneTitle")}</h2>
            <p className="text-muted">{t("doneHint")}</p>
            <Button onClick={leave}>{t("finish")}</Button>
          </section>
        )}
      </div>
    </>
  );
}
