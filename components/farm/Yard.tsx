"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { SomArt } from "@/components/art/Som";
import { BirdArt, ButterflyArt } from "@/components/art/farm/Visitors";
import { DECOR_ART } from "@/components/art/farm/DecorArt";
import { Sheet } from "@/components/today/BlockSheet";
import { Button } from "@/components/ui/Button";
import { YARD_SPOTS } from "@/content/yard";
import type { YardItem } from "@/lib/farm/useFarm";
import { somSpotOfDay, visitors } from "@/lib/game/yard";
import { sfx } from "@/lib/sound/sfx";
import { usePrefs } from "@/lib/store/prefs";

/**
 * The farm yard (docs/FARM_YARD_PLAN.md): decor stands in 8 spots below the plots; tap one to move
 * it ("Move to…", swapping with what's there) or put it away; items in storage wait in a tray.
 * Som sits by one placed item a day; butterflies and birds come with a fuller yard. Cosmetic only:
 * nothing here changes crops, tickets or coins. Read-only when there are no actions (side panel).
 */
export function Yard({
  items,
  today,
  night,
  onPlace,
  onStore,
}: {
  items: YardItem[];
  today: string;
  night: boolean;
  onPlace?: (id: string, spot: number) => Promise<boolean>;
  onStore?: (id: string) => Promise<boolean>;
}) {
  const t = useTranslations("farm.yard");
  const names = useTranslations("decor");
  const skip = usePrefs((s) => s.skipAnimations);
  // What the sheet is about: an item (placed or stored), or an empty spot to fill.
  const [open, setOpen] = useState<{ item: YardItem } | { spot: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const placed = items.filter((i) => i.spot !== null);
  const stored = items.filter((i) => i.spot === null);
  const at = (spot: number) => placed.find((i) => i.spot === spot);
  const som = somSpotOfDay(
    placed.map((i) => i.spot!),
    today,
  );
  const guests = visitors(placed.length);
  const editable = Boolean(onPlace && onStore);
  if (items.length === 0) return null;

  const act = async (fn: () => Promise<boolean>) => {
    setBusy(true);
    setError(false);
    const ok = await fn();
    setBusy(false);
    if (ok) {
      sfx.plant();
      setOpen(null);
    } else setError(true);
  };

  return (
    <>
      <section
        aria-label={t("title")}
        data-yard
        className={`relative h-28 overflow-hidden ${night ? "bg-[var(--sky-night-bottom)]" : "bg-[var(--art-leaf-light)]"}`}
      >
        {YARD_SPOTS.map(({ spot, x, y }) => {
          const item = at(spot);
          const style = { left: `${x * 100}%`, top: `${8 + y * 64}%` };
          if (!item) {
            // An empty spot shows only when there's something in storage to put there.
            if (!editable || stored.length === 0) return null;
            return (
              <button
                key={spot}
                type="button"
                data-spot={spot}
                aria-label={t("emptySpot", { n: spot })}
                onClick={() => setOpen({ spot })}
                className="tap absolute flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border-2 border-dashed border-[var(--art-leaf-3)] text-[var(--art-leaf-3)]"
                style={style}
              >
                +
              </button>
            );
          }
          const Art = DECOR_ART[item.item];
          const label = t("placed", { item: names(item.item), n: spot });
          return (
            <div key={spot} className="absolute -translate-x-1/2" style={style} data-spot={spot}>
              {som === spot && (
                <span aria-hidden="true" className="absolute -left-7 bottom-0">
                  <SomArt pose="sit" className="h-8 w-8" />
                </span>
              )}
              {editable ? (
                <button
                  type="button"
                  aria-label={label}
                  onClick={() => setOpen({ item })}
                  className="tap flex h-11 w-11 items-end justify-center"
                >
                  <Art className="h-11 w-11" />
                </button>
              ) : (
                <span role="img" aria-label={label} className="flex h-11 w-11 items-end justify-center">
                  <Art className="h-11 w-11" />
                </span>
              )}
            </div>
          );
        })}
        {/* Visitors: cosmetic, still under reduced motion and "Skip animations". */}
        {Array.from({ length: guests.butterflies }, (_, i) => (
          <span
            key={`b${i}`}
            aria-hidden="true"
            className={`pointer-events-none absolute ${skip ? "" : "visitor-drift"}`}
            style={{ left: `${20 + i * 27}%`, top: `${10 + (i % 2) * 18}%`, animationDelay: `${i * 0.9}s` }}
          >
            <ButterflyArt className="h-5 w-5" tint={i % 2 ? "sun" : "pink"} />
          </span>
        ))}
        {Array.from({ length: guests.birds }, (_, i) => (
          <span
            key={`r${i}`}
            aria-hidden="true"
            className="pointer-events-none absolute"
            style={{ left: `${44 + i * 14}%`, top: "62%" }}
          >
            <BirdArt className="h-5 w-5" />
          </span>
        ))}
      </section>
      {editable && stored.length > 0 && (
        <section
          aria-label={t("storage", { n: stored.length })}
          className="flex flex-wrap items-center gap-2 px-3 py-2"
        >
          <span className="text-xs font-bold text-muted">{t("storage", { n: stored.length })}</span>
          {stored.map((item) => {
            const Art = DECOR_ART[item.item];
            return (
              <button
                key={item.id}
                type="button"
                aria-label={t("stored", { item: names(item.item) })}
                onClick={() => setOpen({ item })}
                className="tap flex h-11 w-11 items-center justify-center rounded-xl bg-surface"
              >
                <Art className="h-9 w-9" />
              </button>
            );
          })}
        </section>
      )}

      {open && editable && (
        <Sheet
          title={"item" in open ? names(open.item.item) : t("emptySpot", { n: open.spot })}
          onClose={() => setOpen(null)}
        >
          {"item" in open ? (
            <>
              <p className="mb-2 text-sm font-bold">{t("moveTo")}</p>
              <div className="mb-3 grid grid-cols-4 gap-2" role="group" aria-label={t("moveTo")}>
                {YARD_SPOTS.map(({ spot }) => {
                  const there = at(spot);
                  const here = open.item.spot === spot;
                  return (
                    <button
                      key={spot}
                      type="button"
                      disabled={busy || here}
                      aria-label={
                        there && !here
                          ? t("spotSwap", { n: spot, item: names(there.item) })
                          : t("spotFree", { n: spot })
                      }
                      onClick={() => void act(() => onPlace!(open.item.id, spot))}
                      className="tap flex min-h-12 flex-col items-center justify-center rounded-xl bg-surface-2 text-xs font-bold disabled:opacity-50"
                    >
                      {t("spot", { n: spot })}
                      {there && !here && <span className="font-normal text-muted">{names(there.item)}</span>}
                      {here && <span className="font-normal text-muted">{t("here")}</span>}
                    </button>
                  );
                })}
              </div>
              {open.item.spot !== null && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void act(() => onStore!(open.item.id))}
                >
                  {t("putAway")}
                </Button>
              )}
            </>
          ) : (
            <>
              <p className="mb-2 text-sm font-bold">{t("placeHere")}</p>
              <div className="grid grid-cols-4 gap-2">
                {stored.map((item) => {
                  const Art = DECOR_ART[item.item];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={busy}
                      aria-label={t("placeItem", { item: names(item.item), n: open.spot })}
                      onClick={() => void act(() => onPlace!(item.id, open.spot))}
                      className="tap flex min-h-12 flex-col items-center rounded-xl bg-surface-2 p-1 text-xs font-bold disabled:opacity-50"
                    >
                      <Art className="h-10 w-10" />
                      {names(item.item)}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {error && (
            <p role="alert" className="mt-3 text-sm font-bold text-accent">
              {t("error")}
            </p>
          )}
        </Sheet>
      )}
    </>
  );
}
