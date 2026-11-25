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
import { somSpotOfDay, visitorPlaces, visitors } from "@/lib/game/yard";
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
  // Butterflies and birds come by day; at night the yard is quiet (G7 TS S4-7).
  const guests = visitorPlaces(som, night ? { butterflies: 0, birds: 0 } : visitors(placed.length));
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
        className={`relative h-32 overflow-hidden ${night ? "bg-[var(--sky-night-bottom)]" : "bg-[var(--art-leaf-light)]"}`}
      >
        {YARD_SPOTS.map(({ spot, x, y }) => {
          const item = at(spot);
          // Two rows: the back row near the top of the band, the front row near the bottom.
          const style = { left: `${x * 100}%`, top: `${4 + y * 56}%` };
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
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute bottom-0 ${x < 0.5 ? "left-full -ml-1" : "-left-7"}`}
                >
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
        {guests.butterflies.map((x, i) => (
          <span
            key={`b${i}`}
            aria-hidden="true"
            className={`pointer-events-none absolute -translate-x-1/2 ${skip ? "" : "visitor-drift"}`}
            style={{ left: `${x * 100}%`, top: "0%", animationDelay: `${i * 0.9}s` }}
          >
            <ButterflyArt className="h-5 w-5" tint={i % 2 ? "sun" : "pink"} />
          </span>
        ))}
        {guests.birds.map((x, i) => (
          <span
            key={`r${i}`}
            aria-hidden="true"
            className="pointer-events-none absolute -translate-x-1/2"
            style={{ left: `${x * 100}%`, top: "78%" }}
          >
            <BirdArt className="h-5 w-5" />
          </span>
        ))}
      </section>
      {editable && stored.length > 0 && (
        <section
          aria-label={t("storage", { n: stored.length })}
          className="relative z-10 flex flex-wrap items-center gap-2 px-3 py-2"
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
              {/* A map of the yard: the same 4 × 2 layout, back row on top, with what stands where. */}
              <div className="mb-3 grid grid-cols-4 gap-2" role="group" aria-label={t("moveTo")}>
                {YARD_SPOTS.map(({ spot }) => {
                  const there = at(spot);
                  const here = open.item.spot === spot;
                  const Art = there ? DECOR_ART[there.item] : null;
                  return (
                    <button
                      key={spot}
                      type="button"
                      disabled={busy || here}
                      aria-label={
                        here
                          ? t("spotHere", { n: spot })
                          : there
                            ? t("spotSwap", { n: spot, item: names(there.item) })
                            : t("spotFree", { n: spot })
                      }
                      onClick={() => void act(() => onPlace!(open.item.id, spot))}
                      className={`tap relative flex min-h-16 flex-col items-center justify-center rounded-xl text-[11px] font-bold ${
                        here
                          ? "bg-primary-soft text-primary ring-2 ring-[var(--ui-primary)]"
                          : there
                            ? "bg-surface-2"
                            : "border-2 border-dashed border-[var(--ui-border)] bg-transparent text-muted"
                      }`}
                    >
                      {/* the spot's number, as its label reads (G7 TS S4-1) */}
                      <span aria-hidden="true" className="absolute left-1.5 top-1 text-[10px] text-muted">
                        {spot}
                      </span>
                      {Art ? <Art className="h-9 w-9" /> : <span aria-hidden="true">+</span>}
                      {here && <span>{t("here")}</span>}
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
