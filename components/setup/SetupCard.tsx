"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Coin } from "@/components/art/Coin";
import { TicketArt } from "@/components/art/Ticket";
import { CropArt } from "@/components/art/farm/CropArt";
import { DECOR_ART } from "@/components/farm/DecorShop";
import { ChevronIcon } from "@/components/ui/Icons";
import { SETUP_HREF, SETUP_REWARD, SETUP_STEPS, type Reward, type SetupStep } from "@/content/unlocks";
import type { SetupRewards } from "@/lib/setup/useSetupRewards";

/** The reward as a picture (no emoji). */
export function RewardArt({ reward, className = "h-10 w-10" }: { reward: Reward; className?: string }) {
  if ("tickets" in reward) return <TicketArt className={className} kind="sunrise" />;
  if ("coins" in reward) return <Coin className={className} />;
  if ("seed" in reward)
    return <CropArt cropId={reward.seed.crop} stage={3} status="ready" className={className} />;
  const Art = DECOR_ART[reward.decor];
  return <Art className={className} />;
}

function useRewardLabel() {
  const t = useTranslations("setup");
  const crops = useTranslations("crops");
  const decor = useTranslations("decor");
  return (r: Reward) =>
    "tickets" in r
      ? t("rewardTickets", { n: r.tickets })
      : "coins" in r
        ? t("rewardCoins", { n: r.coins })
        : "seed" in r
          ? t("rewardSeeds", { n: r.seed.n, crop: crops(r.seed.crop) })
          : t("rewardDecor", { item: decor(r.decor) });
}

/** A small ring: steps done out of all steps. */
function Ring({ done, total }: { done: number; total: number }) {
  const c = 2 * Math.PI * 16;
  return (
    <svg viewBox="0 0 40 40" className="h-12 w-12 shrink-0" aria-hidden="true">
      <circle cx="20" cy="20" r="16" fill="none" stroke="var(--ui-surface-2)" strokeWidth="5" />
      <circle
        cx="20"
        cy="20"
        r="16"
        fill="none"
        stroke="var(--ui-primary)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${(c * done) / total} ${c}`}
        transform="rotate(-90 20 20)"
      />
    </svg>
  );
}

/**
 * "Set up 24/7" (SPEC §8.8c): each step shows its reward picture; done rows fold away.
 * `compact` = the one quiet line on Today.
 */
export function SetupCard({
  state,
  compact = false,
  onDismiss,
}: {
  state: SetupRewards;
  compact?: boolean;
  onDismiss?: () => void;
}) {
  const t = useTranslations("setup");
  const label = useRewardLabel();
  const [showDone, setShowDone] = useState(false);
  const done = new Set(state.done);
  const todo = SETUP_STEPS.filter((s) => !done.has(s));
  const total = SETUP_STEPS.length;
  if (todo.length === 0 && compact) return null;

  if (compact) {
    const next = todo[0]!;
    return (
      <section
        aria-label={t("title")}
        className="mx-4 mb-3 flex items-center gap-2 rounded-[var(--radius-lg)] bg-surface p-2 lg:mx-6"
      >
        <Link href="/more#setup" className="tap flex min-h-11 flex-1 items-center gap-3 rounded-xl px-1">
          <RewardArt reward={SETUP_REWARD[next]} className="h-9 w-9 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold">{t("title")}</span>
            <span className="block text-sm text-muted">
              {t("progress", { done: total - todo.length, total })}
            </span>
          </span>
          <ChevronIcon className="h-4 w-4 -rotate-90 text-muted" />
        </Link>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="tap min-h-11 rounded-xl px-3 text-sm font-bold text-muted"
          >
            {t("hide")}
          </button>
        )}
      </section>
    );
  }

  const row = (s: SetupStep, isDone: boolean) => (
    <li key={s}>
      <Link
        href={SETUP_HREF[s]}
        className={`tap flex min-h-12 items-center gap-3 rounded-xl bg-surface-2 px-3 py-2 ${isDone ? "opacity-70" : ""}`}
      >
        <RewardArt reward={SETUP_REWARD[s]} className="h-10 w-10 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block font-bold">{t(`step.${s}`)}</span>
          <span className="block text-sm text-muted">
            {isDone ? t("received", { reward: label(SETUP_REWARD[s]) }) : label(SETUP_REWARD[s])}
          </span>
        </span>
        <ChevronIcon className="h-4 w-4 shrink-0 -rotate-90 text-muted" />
      </Link>
    </li>
  );

  return (
    <section
      id="setup"
      aria-label={t("title")}
      className="mx-4 mb-3 rounded-[var(--radius-lg)] bg-surface p-4 lg:mx-6"
    >
      <div className="mb-3 flex items-center gap-3">
        <Ring done={total - todo.length} total={total} />
        <div>
          <h2 className="text-lg font-bold">{t("title")}</h2>
          <p className="text-sm text-muted">{t("progress", { done: total - todo.length, total })}</p>
        </div>
      </div>
      {todo.length > 0 ? (
        <ul className="flex flex-col gap-2">{todo.map((s) => row(s, false))}</ul>
      ) : (
        <p className="text-muted">{t("allDone")}</p>
      )}
      {state.done.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={showDone}
            onClick={() => setShowDone((v) => !v)}
            className="tap mt-2 min-h-11 w-full rounded-xl text-left text-sm font-bold text-muted"
          >
            {t("doneCount", { n: state.done.length })}
          </button>
          {showDone && (
            <ul className="flex flex-col gap-2">
              {SETUP_STEPS.filter((s) => done.has(s)).map((s) => row(s, true))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

const HINT_HIDDEN = "247-setup-hint-hidden";

/** Today's one quiet line for new users until they hide it or finish setting up (per device). */
export function TodaySetupHint({ state }: { state: SetupRewards | null }) {
  const [hidden, setHidden] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(HINT_HIDDEN) === "1";
    } catch {
      return false;
    }
  });
  if (!state || hidden) return null;
  return (
    <SetupCard
      state={state}
      compact
      onDismiss={() => {
        setHidden(true);
        try {
          localStorage.setItem(HINT_HIDDEN, "1");
        } catch {
          // ignore
        }
      }}
    />
  );
}
