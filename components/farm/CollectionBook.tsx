"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { RewardArt } from "@/components/setup/SetupCard";
import { Sheet } from "@/components/today/BlockSheet";
import { ChevronIcon } from "@/components/ui/Icons";
import { UNLOCKS, type UnlockId, type UnlockTier } from "@/content/unlocks";
import { nextUnlock, unlockProgress, type UnlockProgress } from "@/lib/game/unlocks";
import type { UnlocksState } from "@/lib/unlocks/useUnlocks";

const TIERS: UnlockTier[] = ["small", "medium", "big"];

/** A small progress ring around a reward picture; locked rewards are a soft silhouette. */
function Item({ p }: { p: UnlockProgress }) {
  const t = useTranslations("unlocks");
  const c = 2 * Math.PI * 22;
  return (
    <li className="flex items-center gap-3 rounded-xl bg-surface-2 p-2">
      <span className="relative h-14 w-14 shrink-0">
        <svg viewBox="0 0 48 48" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <circle cx="24" cy="24" r="22" fill="none" stroke="var(--ui-surface)" strokeWidth="3" />
          <circle
            cx="24"
            cy="24"
            r="22"
            fill="none"
            stroke="var(--ui-primary)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${(c * p.have) / p.need} ${c}`}
            transform="rotate(-90 24 24)"
          />
        </svg>
        <span
          className={`absolute inset-1.5 flex items-center justify-center ${p.done ? "" : "opacity-40"}`}
          style={p.done ? undefined : { filter: "brightness(0) invert(0.6)" }}
        >
          <RewardArt reward={UNLOCKS[p.id].reward} className="h-10 w-10" />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{t(`goal.${p.id}`)}</span>
        <span className="block text-sm text-muted">
          {p.done ? t("unlocked") : t("left", { n: p.left, need: p.need, have: p.have })}
        </span>
      </span>
    </li>
  );
}

/** The collection book (SPEC §8.8b): every unlock by tier, with progress from the server's counts. */
export function CollectionBook({ state }: { state: UnlocksState }) {
  const t = useTranslations("unlocks");
  const [open, setOpen] = useState(false);
  const progress = unlockProgress(state.counts, state.done);
  const have = progress.filter((p) => p.done).length;
  const next = nextUnlock(progress);
  return (
    <>
      <button
        type="button"
        id="collection"
        onClick={() => setOpen(true)}
        className="tap mx-4 mt-2 flex min-h-11 items-center gap-2 rounded-[var(--radius-lg)] bg-surface p-2 text-left lg:mx-6"
        style={{ width: "calc(100% - 2rem)" }}
      >
        {next ? (
          <RewardArt reward={UNLOCKS[next.id].reward} className="h-10 w-10 shrink-0" />
        ) : (
          <RewardArt reward={{ decor: "pond" }} className="h-10 w-10 shrink-0" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold">{t("title")}</span>
          <span className="block text-sm text-muted">{t("count", { have, total: progress.length })}</span>
        </span>
        <ChevronIcon className="h-4 w-4 -rotate-90 text-muted" />
      </button>
      {open && (
        <Sheet title={t("title")} onClose={() => setOpen(false)}>
          {TIERS.map((tier) => (
            <section key={tier} aria-label={t(`tier.${tier}`)} className="mb-3">
              <h3 className="mb-1 text-sm font-bold text-muted">{t(`tier.${tier}`)}</h3>
              <ul className="flex flex-col gap-2">
                {progress
                  .filter((p) => UNLOCKS[p.id].tier === tier)
                  .map((p) => (
                    <Item key={p.id} p={p} />
                  ))}
              </ul>
            </section>
          ))}
        </Sheet>
      )}
    </>
  );
}

/** Today's one quiet line: the closest unlock (SPEC §8.8b). */
export function TodayUnlockLine({ state }: { state: UnlocksState }) {
  const t = useTranslations("unlocks");
  const next = nextUnlock(unlockProgress(state.counts, state.done));
  if (!next) return null;
  return (
    <Link
      href="/farm#collection"
      className="tap mx-4 mb-3 flex min-h-11 items-center gap-2 rounded-xl px-1 text-sm text-muted lg:mx-6"
    >
      <RewardArt reward={UNLOCKS[next.id].reward} className="h-8 w-8 shrink-0" />
      <span className="min-w-0 flex-1">{t(`next.${UNLOCKS[next.id].metric}`, { n: next.left })}</span>
      <ChevronIcon className="h-4 w-4 -rotate-90" />
    </Link>
  );
}

/** "Unlocked: Garden lantern" after a claim paid something. Stays until OK. */
export function UnlockNotice({ granted }: { granted: UnlockId[] }) {
  const t = useTranslations("unlocks");
  const [seen, setSeen] = useState(false);
  if (seen || granted.length === 0) return null;
  return (
    <section
      role="status"
      className="mx-4 mb-3 flex items-center gap-3 rounded-[var(--radius-lg)] bg-primary-soft p-3 lg:mx-6"
    >
      <RewardArt reward={UNLOCKS[granted[0]!].reward} className="h-10 w-10 shrink-0" />
      <p className="min-w-0 flex-1 text-sm">
        <span className="block font-bold text-primary">{t("unlockedTitle")}</span>
        {granted.map((id) => t(`goal.${id}`)).join(" · ")}
      </p>
      <button
        type="button"
        onClick={() => setSeen(true)}
        className="tap min-h-11 rounded-xl px-3 text-sm font-bold text-primary"
      >
        {t("ok")}
      </button>
    </section>
  );
}
