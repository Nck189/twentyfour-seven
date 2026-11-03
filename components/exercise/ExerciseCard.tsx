"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { ExerciseArt } from "@/components/art/Exercise";
import { Sheet } from "@/components/today/BlockSheet";
import { Button } from "@/components/ui/Button";
import { EXERCISE_TYPES, type ExerciseType } from "@/content/animals";
import type { LogResult, useAnimals } from "@/lib/animals/useAnimals";
import { sfx } from "@/lib/sound/sfx";
import { HatchReveal } from "./HatchReveal";

const MINUTES = [10, 20, 30, 45, 60, 90] as const;

/** The weekly ring (SPEC §6): sessions this week out of the goal; no daily requirement. */
export function WeekRing({
  done,
  goal,
  className = "h-12 w-12",
}: {
  done: number;
  goal: number;
  className?: string;
}) {
  const c = 2 * Math.PI * 16;
  const part = goal > 0 ? Math.min(1, done / goal) : 0;
  return (
    <svg viewBox="0 0 40 40" className={`${className} shrink-0`} aria-hidden="true">
      <circle cx="20" cy="20" r="16" fill="none" stroke="var(--ui-surface-2)" strokeWidth="5" />
      {part > 0 && (
        <circle
          cx="20"
          cy="20"
          r="16"
          fill="none"
          stroke="var(--ui-primary)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${c * part} ${c}`}
          transform="rotate(-90 20 20)"
        />
      )}
    </svg>
  );
}

/** Log a workout: type as pictures + minutes as chips → one tap to save (server feeds + eggs). */
export function LogSheet({
  onLog,
  onClose,
  hasAnimals,
}: {
  onLog: (type: ExerciseType, minutes: number) => Promise<LogResult | null>;
  onClose: () => void;
  hasAnimals: boolean;
}) {
  const t = useTranslations("exercise");
  const [type, setType] = useState<ExerciseType>("gym");
  const [minutes, setMinutes] = useState<number>(30);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [result, setResult] = useState<LogResult | "error" | null>(null);
  const [hatch, setHatch] = useState<LogResult["hatched"]>(null);

  const save = async () => {
    // One log per tap (the server also keys each tap).
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const r = await onLog(type, minutes).catch(() => null);
    busyRef.current = false;
    setBusy(false);
    setResult(r ?? "error");
    if (r) sfx.tick();
    if (r?.hatched) setHatch(r.hatched);
  };

  const message =
    result === "error"
      ? t("error")
      : result
        ? result.counted
          ? hasAnimals || result.hatched
            ? t("fed")
            : t("fedNone")
          : minutes < 10
            ? t("notCountedShort")
            : t("notCountedCap")
        : null;

  return (
    <Sheet title={t("logTitle")} onClose={onClose}>
      <p className="mb-2 text-sm font-bold text-muted">{t("typeLabel")}</p>
      <div role="radiogroup" aria-label={t("typeLabel")} className="mb-4 grid grid-cols-4 gap-2">
        {EXERCISE_TYPES.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={type === k}
            onClick={() => setType(k)}
            className={`tap flex min-h-11 flex-col items-center rounded-xl p-1 ${
              type === k ? "bg-primary-soft ring-2 ring-primary" : "bg-surface-2"
            }`}
          >
            <ExerciseArt type={k} className="h-10 w-10" />
            <span className="text-xs font-bold">{t(`type.${k}`)}</span>
          </button>
        ))}
      </div>
      <p className="mb-2 text-sm font-bold text-muted">{t("minutes")}</p>
      <div role="radiogroup" aria-label={t("minutes")} className="mb-4 grid grid-cols-3 gap-2">
        {MINUTES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={minutes === m}
            onClick={() => setMinutes(m)}
            className={`tap min-h-11 rounded-xl text-sm font-bold ${
              minutes === m ? "bg-primary text-on-primary" : "bg-surface-2"
            }`}
          >
            {t("minutesValue", { n: m })}
          </button>
        ))}
      </div>
      <Button className="w-full" disabled={busy} onClick={() => void save()}>
        {t("save")}
      </Button>
      {message && (
        <p
          role={result === "error" ? "alert" : "status"}
          className={`mt-3 rounded-xl p-3 text-sm font-bold ${result === "error" ? "bg-accent-soft" : "bg-primary-soft text-primary"}`}
        >
          {message}
          {result && result !== "error" && !result.hatched && (
            <span className="block font-normal">{t("eggProgress", { n: result.eggProgress })}</span>
          )}
        </p>
      )}
      {hatch && <HatchReveal hatched={hatch} onDone={() => setHatch(null)} />}
    </Sheet>
  );
}

/** Today's exercise card: the weekly ring + one button to log. */
export function ExerciseCard({ animals }: { animals: ReturnType<typeof useAnimals> }) {
  const t = useTranslations("exercise");
  const [open, setOpen] = useState(false);
  const s = animals.state;
  if (!s) return null;
  const done = s.week.length;
  return (
    <section
      aria-label={t("title")}
      className="mx-4 mb-3 flex items-center gap-3 rounded-[var(--radius-lg)] bg-surface p-3 lg:mx-6"
    >
      <WeekRing done={done} goal={s.weeklyGoal} />
      <div className="min-w-0 flex-1">
        <p className="font-bold">{t("title")}</p>
        <p className="text-sm text-muted" aria-label={t("ringLabel", { done, goal: s.weeklyGoal })}>
          {t("ring", { done, goal: s.weeklyGoal })}
        </p>
      </div>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t("log")}
      </Button>
      {open && (
        <LogSheet
          hasAnimals={s.animals.length > 0}
          onLog={animals.logExercise}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  );
}
