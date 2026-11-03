"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { AnimalArt, EggArt, FeedArt, Heart, ProduceArt } from "@/components/art/farm/Animals";
import { Sheet } from "@/components/today/BlockSheet";
import { Button } from "@/components/ui/Button";
import { ANIMALS, type ProduceId } from "@/content/animals";
import type { Animal, useAnimals } from "@/lib/animals/useAnimals";
import { feedDaysLeft, isFed, loveHearts, produceReady } from "@/lib/game/animals";
import { sfx } from "@/lib/sound/sfx";
import { usePrefs } from "@/lib/store/prefs";

/** One animal up close: love, fed or sleepy, and its three actions (pet, collect, feed). */
function AnimalSheet({
  animal,
  feed,
  actions,
  onClose,
}: {
  animal: Animal;
  feed: number;
  actions: ReturnType<typeof useAnimals>;
  onClose: () => void;
}) {
  const t = useTranslations("pen");
  const name = useTranslations("animals")(animal.species);
  const produceName = useTranslations("produce");
  const reduce = useReducedMotion();
  const skip = usePrefs((s) => s.skipAnimations) || Boolean(reduce);
  const now = new Date();
  const fed = isFed(animal.fedUntil, now);
  const ready = produceReady(animal, now);
  const item: ProduceId = ANIMALS[animal.species].produce;
  const hearts = loveHearts(animal.love);
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);
  const [hearts2, setHearts2] = useState(0);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const run = async (fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <Sheet title={name} onClose={onClose}>
      <div className="flex flex-col items-center">
        <div className="relative">
          <AnimalArt species={animal.species} sleepy={!fed} className="h-40 w-40" />
          <AnimatePresence>
            {!skip && hearts2 > 0 && (
              <motion.span
                key={hearts2}
                aria-hidden="true"
                className="absolute top-2 right-4"
                initial={{ opacity: 0, y: 8, scale: 0.6 }}
                animate={{ opacity: [0, 1, 0], y: -24, scale: 1 }}
                transition={{ duration: 0.9 }}
              >
                <Heart className="h-7 w-7" />
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div className="mb-1 flex" role="img" aria-label={t("love", { n: hearts })}>
          {Array.from({ length: 5 }, (_, i) => (
            <Heart key={i} empty={i >= hearts} className="h-6 w-6" />
          ))}
        </div>
        <p className={`text-center text-sm ${fed ? "text-muted" : "rounded-xl bg-warn-soft p-2 text-warn"}`}>
          {fed ? t("fedFor", { n: feedDaysLeft(animal.fedUntil, now) }) : t("sleepy")}
        </p>
      </div>
      <div className="mt-4 grid gap-2">
        <Button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              sfx.animal(ANIMALS[animal.species].pitch, !fed);
              setHearts2((n) => n + 1);
              const counted = await actions.pet(animal.id);
              setNote({ text: counted ? t("petted", { name }) : t("petEnough", { name }) });
            })
          }
        >
          {t("pet")}
        </Button>
        {ready ? (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const got = await actions.collect(animal.id);
                if (got) {
                  sfx.pop();
                  setNote({ text: t("collected", { item: produceName(got) }) });
                } else setNote({ text: t("error"), error: true });
              })
            }
          >
            <span className="flex items-center justify-center gap-2">
              <ProduceArt id={item} className="h-7 w-7" />
              {t("collect", { item: produceName(item) })}
            </span>
          </Button>
        ) : (
          <p className="flex items-center justify-center gap-2 text-sm text-muted">
            <ProduceArt id={item} className="h-7 w-7" />
            {t("notYet", { item: produceName(item) })}
          </p>
        )}
        {feed > 0 && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const ok = await actions.feed(animal.id);
                setNote(ok ? { text: t("fedOne") } : { text: t("error"), error: true });
              })
            }
          >
            <span className="flex items-center justify-center gap-2">
              <FeedArt className="h-7 w-7" />
              {t("feed", { n: feed })}
            </span>
          </Button>
        )}
      </div>
      {note && (
        <p
          role={note.error ? "alert" : "status"}
          className={`mt-3 rounded-xl p-3 text-sm font-bold ${note.error ? "bg-accent-soft" : "bg-primary-soft text-primary"}`}
        >
          {note.text}
        </p>
      )}
    </Sheet>
  );
}

/**
 * The animal pen on the Farm (SPEC §8.6): the egg incubator (workouts toward the next egg) and
 * every animal. Hungry animals sleep — they never die. Tap one to pet it, collect, or feed it.
 */
export function AnimalPen({ animals }: { animals: ReturnType<typeof useAnimals> }) {
  const t = useTranslations("pen");
  const names = useTranslations("animals");
  const [open, setOpen] = useState<string | null>(null);
  const s = animals.state;
  if (!s) return null;
  const now = new Date();
  const selected = s.animals.find((a) => a.id === open);
  return (
    <section aria-label={t("title")} className="mx-4 mt-4 lg:mx-6">
      <h2 className="mb-1 text-sm font-bold text-muted">{t("title")}</h2>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        <li className="flex flex-col items-center rounded-[var(--radius-lg)] bg-surface p-2 text-center">
          <EggArt progress={s.eggProgress} className="h-16 w-16" />
          <span className="text-xs font-bold">{t("incubator")}</span>
          <span className="text-[11px] text-muted">{t("eggProgress", { n: s.eggProgress })}</span>
        </li>
        {s.animals.map((a) => {
          const fed = isFed(a.fedUntil, now);
          return (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => setOpen(a.id)}
                aria-label={t("tile", {
                  name: names(a.species),
                  state: fed ? t("stateFed") : t("stateSleepy"),
                })}
                className="tap flex w-full flex-col items-center rounded-[var(--radius-lg)] bg-surface p-2"
              >
                <AnimalArt species={a.species} sleepy={!fed} className="h-16 w-16" />
                <span className="max-w-full truncate text-xs font-bold" aria-hidden="true">
                  {names(a.species)}
                </span>
                {produceReady(a, now) && (
                  <span aria-hidden="true" className="-mt-1">
                    <ProduceArt id={ANIMALS[a.species].produce} className="h-5 w-5" />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {s.animals.length === 0 && (
        <p className="mt-2 text-sm text-muted">
          {t("empty")} {t("eggHint")}
        </p>
      )}
      {selected && (
        <AnimalSheet animal={selected} feed={s.feed} actions={animals} onClose={() => setOpen(null)} />
      )}
    </section>
  );
}
