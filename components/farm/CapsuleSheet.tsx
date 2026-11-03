"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Capsule, CapsuleMachine, RarityLight } from "@/components/art/farm/Capsule";
import { CropArt } from "@/components/art/farm/CropArt";
import { TicketArt } from "@/components/art/Ticket";
import { Sheet } from "@/components/today/BlockSheet";
import { Button } from "@/components/ui/Button";
import { RARITIES } from "@/content/crops";
import { MULTI_PULL, PITY } from "@/content/gacha";
import type { GachaState, PullResult } from "@/lib/farm/useGacha";
import { sfx } from "@/lib/sound/sfx";
import { usePrefs } from "@/lib/store/prefs";

const RANK = Object.fromEntries(RARITIES.map((r, i) => [r, i])) as Record<PullResult["rarity"], number>;

/** One result card: the crop on its rarity light, NEW or +shards. */
function ResultCard({ r, big = false }: { r: PullResult; big?: boolean }) {
  const t = useTranslations("gacha");
  const crop = useTranslations("crops")(r.crop);
  return (
    <div className="relative flex flex-col items-center">
      <div className={`relative ${big ? "h-40 w-40" : "h-16 w-16"}`}>
        <RarityLight rarity={r.rarity} className="absolute inset-0 h-full w-full" />
        <CropArt cropId={r.crop} stage={3} status="ready" className="absolute inset-0 h-full w-full" />
      </div>
      <p className={`${big ? "text-xl" : "text-xs"} max-w-full truncate font-extrabold`}>{crop}</p>
      <p className={`${big ? "text-sm" : "text-[11px] leading-tight"} text-center text-muted`}>
        {t(`rarity.${r.rarity}`)}
        {big ? " · " : <br />}
        <span className={r.new ? "font-bold text-primary" : undefined}>
          {r.new ? t("new") : t("shards", { n: r.shards })}
        </span>
      </p>
    </div>
  );
}

/**
 * The reveal (SPEC §8.5): shake → crack → rarity light → crop, jingle rising with rarity.
 * ×10 cracks the capsules one after another. Skip shows the results at once; reduced motion and
 * "skip animations" go straight to them.
 */
export function Reveal({ results, onDone }: { results: PullResult[]; onDone: () => void }) {
  const t = useTranslations("gacha");
  const reduce = useReducedMotion();
  const skipPref = usePrefs((s) => s.skipAnimations) || Boolean(reduce);
  const [phase, setPhase] = useState<"shake" | "crack" | "shown">(skipPref ? "shown" : "shake");
  const best = useMemo(() => results.reduce((m, r) => Math.max(m, RANK[r.rarity]), 0), [results]);
  const top = results.find((r) => RANK[r.rarity] === best)!;
  const crops = useTranslations("crops");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const shown = useRef(false);
  const box = useRef<HTMLDivElement>(null);

  // Phases only move forward: once the results are shown (timer or Skip), nothing pulls them back.
  const show = useCallback(() => {
    if (shown.current) return;
    shown.current = true;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    sfx.jingle(best);
    setPhase("shown");
  }, [best]);

  useEffect(() => {
    if (skipPref) {
      show();
      return;
    }
    sfx.shake();
    timers.current = [
      setTimeout(() => {
        if (shown.current) return;
        sfx.crack();
        setPhase("crack");
      }, 700),
      setTimeout(show, 700 + (results.length > 1 ? 150 * results.length : 450)),
    ];
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [skipPref, show, results.length]);

  // Keyboard and screen-reader focus follows the one button: Skip, then Done.
  useEffect(() => {
    box.current?.querySelector<HTMLButtonElement>("button[data-reveal-action]")?.focus();
  }, [phase]);

  return (
    <div
      ref={box}
      role="dialog"
      aria-modal="true"
      aria-label={t("results")}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-bg p-4"
    >
      <p role="status" className="sr-only">
        {phase === "shown" ? results.map((r) => crops(r.crop)).join(", ") : ""}
      </p>
      <AnimatePresence mode="wait">
        {phase === "shake" && (
          <motion.div
            key="shake"
            animate={{ rotate: [0, -6, 6, -4, 4, 0], scale: [1, 1.03, 1] }}
            transition={{ duration: 0.65 }}
          >
            <CapsuleMachine className="h-48 w-48" />
          </motion.div>
        )}
        {phase === "crack" && (
          <motion.div
            key="crack"
            className="flex flex-wrap justify-center gap-2"
            initial={{ y: -30 }}
            animate={{ y: 0 }}
          >
            {(results.length > 1 ? results : [top]).map((r, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: [0.6, 1.1, 1], opacity: 1 }}
                transition={{ delay: i * 0.12, duration: 0.3 }}
              >
                <Capsule
                  rarity={r.rarity}
                  open={0}
                  className={results.length > 1 ? "h-14 w-14" : "h-40 w-40"}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
        {phase === "shown" && (
          <motion.div
            key="shown"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
            className="flex w-full max-w-md flex-col items-center gap-3"
          >
            {results.length === 1 ? (
              <ResultCard r={results[0]!} big />
            ) : (
              <ul className="grid w-full grid-cols-5 gap-2" aria-label={t("results")}>
                {results.map((r, i) => (
                  <li key={i}>
                    <ResultCard r={r} />
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {phase === "shown" ? (
        <Button data-reveal-action onClick={onDone} className="min-w-40">
          {t("done")}
        </Button>
      ) : (
        <Button data-reveal-action variant="secondary" onClick={show}>
          {t("skip")}
        </Button>
      )}
    </div>
  );
}

/** The capsule machine sheet: tickets, pity counters, ×1 / ×10. */
export function CapsuleSheet({
  state,
  pull,
  onClose,
}: {
  state: GachaState;
  pull: (n: 1 | 10, key: string) => Promise<PullResult[] | null>;
  onClose: () => void;
}) {
  const t = useTranslations("gacha");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [results, setResults] = useState<PullResult[] | null>(null);
  const left = {
    rare: PITY.rare - state.pity.since_rare,
    epic: PITY.epic - state.pity.since_epic,
    legendary: PITY.legendary - state.pity.since_legendary,
  };

  const busyRef = useRef(false);
  const go = async (n: 1 | 10) => {
    // One pull per tap: a double-tap never starts a second pull (CJ-12).
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(false);
    // One key per tap: a retried request after a dropped connection is never charged twice.
    const key = `${n}-${crypto.randomUUID()}`;
    let out = await pull(n, key);
    if (!out) out = await pull(n, key);
    busyRef.current = false;
    setBusy(false);
    // An empty answer (shouldn't happen) is treated as a failed pull, never an empty reveal.
    if (out && out.length > 0) setResults(out);
    else setError(true);
  };

  return (
    <Sheet title={t("title")} onClose={onClose}>
      <div className="flex flex-col items-center gap-2">
        <CapsuleMachine className="h-36 w-36" />
        <p className="flex items-center gap-1 text-lg font-extrabold">
          <TicketArt className="h-6 w-9" kind="sunrise" />
          {t("tickets", { n: state.tickets })}
        </p>
        <p className="text-center text-sm text-muted">
          {t("pityRare", { n: left.rare })} · {t("pityEpic", { n: left.epic })} ·{" "}
          {t("pityLegendary", { n: left.legendary })}
        </p>
        <div className="mt-2 grid w-full grid-cols-2 gap-2">
          <Button disabled={busy || state.tickets < 1} onClick={() => void go(1)}>
            {t("pull1")}
          </Button>
          <Button disabled={busy || state.tickets < MULTI_PULL} onClick={() => void go(10)}>
            {t("pull10")}
          </Button>
        </div>
        {state.tickets < 1 && <p className="text-sm text-muted">{t("howToEarn")}</p>}
        {error && (
          <p role="alert" className="w-full rounded-xl bg-accent-soft p-3 text-sm font-bold">
            {t("error")}
          </p>
        )}
      </div>
      {results && <Reveal results={results} onDone={() => setResults(null)} />}
    </Sheet>
  );
}
