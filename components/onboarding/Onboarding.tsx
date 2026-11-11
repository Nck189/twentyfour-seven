"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckIcon } from "@/components/ui/Icons";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { useSetup } from "@/lib/onboarding/useSetup";
import type { TemplateRow } from "@/lib/today/day";
import { BLOCKS_WITHOUT_DEFAULT_FIRST10 } from "@/content/blocks";
import { groupWeek, parseIcs } from "@/lib/onboarding/schedule";
import { suggestionToken } from "@/lib/onboarding";
import { First10Step } from "./First10Step";
import { StarterStep } from "./StarterStep";
import { WeekStep } from "./WeekStep";

const STEPS = ["starter", "week", "first10", "done"] as const;
type Step = (typeof STEPS)[number];

/**
 * First-run setup: "what's your week like?" (one tap fills everything) → the week (review) →
 * first-10s ("use all suggestions") → done. Lazy path ≈ 4 taps; every step skippable. Also
 * opened from More with `?step=week|first10&from=more` to edit later (finishing returns there).
 */
export function Onboarding() {
  const t = useTranslations("onboarding");
  const tc = useTranslations("common");
  const tt = useTranslations("templates");
  const router = useRouter();
  const params = useSearchParams();
  const fromMore = params.get("from") === "more";
  // "sleep" is the older name of the week step (links from earlier builds).
  const asked = (params.get("step") === "sleep" ? "week" : params.get("step")) as Step | null;
  const [step, setStepState] = useState<Step>(asked && STEPS.includes(asked) ? asked : "starter");
  // The step lives in the URL too, so a reload resumes it instead of starting over (playtest R1
  // P5: restarting re-ran the starter and piled up duplicate kinds of day).
  const setStep = (next: Step) => {
    setStepState(next);
    const q = new URLSearchParams(params.toString());
    q.set("step", next);
    router.replace(`?${q.toString()}`, { scroll: false });
  };
  const setup = useSetup();
  const [kindOpen, setKindOpen] = useState(false);

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
  const nameOf = (x: TemplateRow) =>
    x.name ?? (tt.has(x.key as Parameters<typeof tt>[0]) ? tt(x.key as Parameters<typeof tt>[0]) : x.key);
  async function importIcs(text: string) {
    const week = parseIcs(text, setup.timezone);
    if (!Object.keys(week).length) return t("importEmpty");
    const kinds = groupWeek(week);
    await setup.applyWeekKinds(kinds, (k) =>
      [...new Set(k.events.map((e) => e.title).filter(Boolean))].join(", ").slice(0, 40),
    );
    return t("imported", { count: kinds.length });
  }
  async function acceptAllFirst10() {
    for (const b of setup.blocks) {
      if (BLOCKS_WITHOUT_DEFAULT_FIRST10.includes(b.key) && !b.first10) {
        await setup.setFirst10(b.key, suggestionToken(b.key, 1));
      }
    }
    await done();
  }
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
        {setup.status === "ready" && step === "starter" && (
          <StarterStep
            onPick={async (starter) => {
              if (starter) await setup.applyStarter(starter);
              setStep("week");
            }}
          />
        )}
        {setup.status === "ready" && step === "week" && (
          <>
            <WeekStep
              templates={setup.templates}
              version={setup.version}
              nameOf={nameOf}
              onSleep={setup.setSleep}
              onAllSleep={(w, m) => void setup.setAllSleep(w, m)}
              onMoveDay={(d, id) => void setup.moveWeekday(d, id)}
              onRemoveDay={(d, id) => void setup.removeWeekday(d, id)}
              onEvents={setup.setEvents}
              onAddKind={() =>
                void setup.addKind(
                  t("newKind", { n: setup.templates.filter((x) => x.auto_apply).length + 1 }),
                )
              }
              onImportIcs={importIcs}
              onEditingChange={setKindOpen}
            />
            {!kindOpen && (
              <Button onClick={() => (fromMore ? leave() : setStep("first10"))}>
                {fromMore ? t("finish") : t("next")}
              </Button>
            )}
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
              onUseAll={() => void acceptAllFirst10()}
            />
            <div className="flex gap-2">
              {!fromMore && (
                <Button variant="secondary" onClick={() => setStep("week")}>
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
