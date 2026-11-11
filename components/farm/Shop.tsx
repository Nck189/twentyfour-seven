"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Coin } from "@/components/art/Coin";
import { TicketArt } from "@/components/art/Ticket";
import { CropArt } from "@/components/art/farm/CropArt";
import { ProduceArt } from "@/components/art/farm/Animals";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { REWARD_COST, REWARD_TITLE_MAX, UPGRADE_TRACKS, type UpgradeTrack } from "@/content/economy";
import type { DecorId } from "@/content/decor";
import type { Season } from "@/content/seasons";
import { nextUpgradePrice, parseItem } from "@/lib/game/market";
import { useMarket, type MarketStatus } from "@/lib/market/useMarket";
import { sfx } from "@/lib/sound/sfx";
import { DecorShop } from "./DecorShop";

type Tab = "market" | "shop" | "upgrades" | "rewards";

/**
 * The farm shop (docs/ECONOMY.md, Minnie OK 2026-11-11): sell produce and fill daily orders,
 * buy seeds / tickets / decor, upgrade, and the user's own reward jar. The server prices and
 * decides everything; this only shows what it says and asks.
 */
export function Shop({
  onBuyDecor,
  season,
  onChanged,
}: {
  onBuyDecor: (item: DecorId) => Promise<boolean>;
  season?: Season;
  /** The farm reloads its coins after a sale or purchase. */
  onChanged: () => void;
}) {
  const t = useTranslations("shop");
  const m = useMarket();
  const [tab, setTab] = useState<Tab>("market");
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const s = m.status;

  const run = async (key: string, action: () => Promise<boolean>) => {
    setBusy(key);
    setFailed(false);
    const ok = await action();
    setBusy(null);
    if (ok) {
      sfx.tick();
      onChanged();
    } else setFailed(true);
  };

  return (
    <section aria-label={t("title")} className="mx-4 mt-4 flex flex-col gap-3 lg:mx-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-muted">{t("title")}</h2>
        {s && (
          <p className="flex items-center gap-1 text-sm font-bold">
            <Coin className="h-5 w-5" />
            <span aria-hidden="true">{s.coins}</span>
            <span className="sr-only">{t("coins", { n: s.coins })}</span>
          </p>
        )}
      </div>
      <Segmented<Tab>
        label={t("title")}
        value={tab}
        onChange={setTab}
        compact
        options={[
          { value: "market", label: t("tab.market") },
          { value: "shop", label: t("tab.shop") },
          { value: "upgrades", label: t("tab.upgrades") },
          { value: "rewards", label: t("tab.rewardsShort") },
        ]}
      />
      {m.error && !s && (
        <p role="alert" className="rounded-xl bg-accent-soft p-3 text-sm font-bold">
          {t("loadError")}{" "}
          <button type="button" className="tap min-h-11 underline" onClick={m.reload}>
            {t("retry")}
          </button>
        </p>
      )}
      {!s && !m.error && <p className="text-sm text-muted">{t("loading")}</p>}
      {s && tab === "market" && <MarketTab s={s} busy={busy} run={run} m={m} />}
      {s && tab === "shop" && (
        <>
          <SeedsAndTickets s={s} busy={busy} run={run} m={m} />
          <DecorShop coins={s.coins} onBuy={onBuyDecor} season={season} embedded />
        </>
      )}
      {s && tab === "upgrades" && <Upgrades s={s} busy={busy} run={run} m={m} />}
      {s && tab === "rewards" && <Rewards s={s} busy={busy} run={run} m={m} />}
      {failed && (
        <p role="alert" className="rounded-xl bg-accent-soft p-3 text-sm font-bold">
          {t("actionError")}
        </p>
      )}
    </section>
  );
}

type TabProps = {
  s: MarketStatus;
  busy: string | null;
  run: (key: string, action: () => Promise<boolean>) => Promise<void>;
  m: ReturnType<typeof useMarket>;
};

function Card({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <li
      aria-label={label}
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-surface p-2 pr-3"
    >
      {children}
    </li>
  );
}

function Price({ n }: { n: number }) {
  return (
    <span className="flex items-center gap-0.5 text-sm font-bold" aria-hidden="true">
      <Coin className="h-4 w-4" />
      {n}
    </span>
  );
}

function MarketTab({ s, busy, run, m }: TabProps) {
  const t = useTranslations("shop");
  const tf = useTranslations("farm");
  const crops = useTranslations("crops");
  const produce = useTranslations("produce");
  const have = (crop: string) =>
    s.shelf
      .filter((x) => x.item === `crop:${crop}` || x.item.startsWith(`crop:${crop}:`))
      .reduce((a, x) => a + x.qty, 0);
  return (
    <>
      <h3 className="text-sm font-bold">{t("ordersTitle")}</h3>
      <ul className="flex flex-col gap-2">
        {s.orders.map((o) => {
          const enough = have(o.crop) >= o.qty;
          return (
            <Card key={o.slot} label={t("order", { n: o.qty, crop: crops(o.crop) })}>
              <CropArt cropId={o.crop} stage={3} status="ready" className="h-11 w-11 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{t("order", { n: o.qty, crop: crops(o.crop) })}</span>
                <span className="text-xs text-muted">{t("orderHave", { n: have(o.crop) })}</span>
              </span>
              {o.done ? (
                <span className="text-sm font-bold text-primary">{t("delivered")}</span>
              ) : (
                <Button
                  variant="secondary"
                  disabled={!enough || busy !== null}
                  onClick={() => void run(`order-${o.slot}`, () => m.deliver(o.slot))}
                >
                  <Coin className="h-4 w-4" />
                  {t("deliver", { coins: o.coins })}
                </Button>
              )}
            </Card>
          );
        })}
      </ul>
      <h3 className="text-sm font-bold">{t("sellTitle")}</h3>
      {s.shelf.length === 0 ? (
        <p className="text-sm text-muted">{t("shelfEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {s.shelf.map((x) => {
            const it = parseItem(x.item);
            if (!it) return null;
            const name = it.kind === "crop" ? crops(it.cropId) : produce(it.id);
            return (
              <li
                key={x.item}
                aria-label={name}
                className="flex flex-col gap-2 rounded-xl bg-surface p-2 pr-3"
              >
                <div className="flex items-center gap-3">
                  {it.kind === "crop" ? (
                    <CropArt cropId={it.cropId} stage={3} status="ready" className="h-11 w-11 shrink-0" />
                  ) : (
                    <ProduceArt id={it.id} className="h-11 w-11 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">
                      {name} <span className="text-muted">×{x.qty}</span>
                    </span>
                    {it.kind === "crop" && (
                      <span className="text-xs text-muted">
                        {tf(`qualityName.${it.quality}`)}
                        {it.mult > 1 && ` · ${tf("multiplier", { n: Math.round(it.mult * 10) / 10 })}`}
                      </span>
                    )}
                  </span>
                  <Price n={x.price} />
                </div>
                <div className="flex justify-end gap-2">
                  {x.qty > 1 && (
                    <Button
                      variant="ghost"
                      disabled={busy !== null}
                      aria-label={t("sellAllLabel", { item: name, coins: x.price * x.qty })}
                      onClick={() => void run(`sellall-${x.item}`, () => m.sell(x.item, x.qty))}
                    >
                      {t("sellAll")}
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    disabled={busy !== null}
                    aria-label={t("sellOne", { item: name, coins: x.price })}
                    onClick={() => void run(`sell-${x.item}`, () => m.sell(x.item, 1))}
                  >
                    {t("sell")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function SeedsAndTickets({ s, busy, run, m }: TabProps) {
  const t = useTranslations("shop");
  const crops = useTranslations("crops");
  const left = s.exchange.max - s.exchange.used;
  return (
    <>
      <h3 className="text-sm font-bold">{t("seedsTitle")}</h3>
      <ul className="grid grid-cols-3 gap-2">
        {s.seeds.map((x) => (
          <li key={x.crop}>
            <button
              type="button"
              disabled={busy !== null || s.coins < x.price}
              aria-label={t("buySeed", { crop: crops(x.crop), coins: x.price })}
              onClick={() => void run(`seed-${x.crop}`, () => m.buySeed(x.crop))}
              className="tap flex min-h-11 w-full flex-col items-center rounded-xl bg-surface p-2 disabled:opacity-50"
            >
              <CropArt cropId={x.crop} stage={3} status="ready" className="h-12 w-12" />
              <span className="text-xs font-bold">{crops(x.crop)}</span>
              <Price n={x.price} />
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">{t("seedsHint")}</p>
      <div className="flex items-center gap-3 rounded-xl bg-surface p-3">
        <TicketArt className="h-10 w-14 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block font-bold">{t("exchangeTitle", { coins: s.exchange.price })}</span>
          <span className="text-xs text-muted">{t("exchangeLeft", { n: left, max: s.exchange.max })}</span>
        </span>
        <Button
          variant="secondary"
          disabled={busy !== null || left <= 0 || s.coins < s.exchange.price}
          onClick={() => void run("exchange", m.exchange)}
        >
          {t("exchange")}
        </Button>
      </div>
    </>
  );
}

function Upgrades({ s, busy, run, m }: TabProps) {
  const t = useTranslations("shop");
  return (
    <ul className="flex flex-col gap-2">
      {UPGRADE_TRACKS.map((track: UpgradeTrack) => {
        const level = s.levels[track];
        const price = nextUpgradePrice(track, level);
        const max = level + (price === null ? 0 : 1) + (nextUpgradePrice(track, level + 1) === null ? 0 : 1);
        return (
          <li key={track} className="flex flex-col gap-2 rounded-xl bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold">{t(`upgrade.${track}.name`)}</span>
              <span className="text-sm text-muted">{t("level", { n: level })}</span>
            </div>
            <p className="text-sm text-muted">{t(`upgrade.${track}.effect`)}</p>
            <div className="flex gap-1" aria-hidden="true">
              {Array.from({ length: Math.max(max, level) }, (_, i) => (
                <span
                  key={i}
                  className={`h-2 flex-1 rounded-full ${i < level ? "bg-primary" : "bg-surface-2"}`}
                />
              ))}
            </div>
            {price === null ? (
              <p className="text-sm font-bold text-primary">{t("maxed")}</p>
            ) : (
              <Button
                variant="secondary"
                disabled={busy !== null || s.coins < price}
                onClick={() => void run(`up-${track}`, () => m.upgrade(track))}
              >
                <Coin className="h-4 w-4" />
                {t("upgradeTo", { n: level + 1, coins: price })}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Rewards({ s, busy, run, m }: TabProps) {
  const t = useTranslations("shop");
  const [title, setTitle] = useState("");
  const [cost, setCost] = useState("100");
  const n = Number(cost);
  const valid =
    title.trim().length > 0 && Number.isInteger(n) && n >= REWARD_COST.min && n <= REWARD_COST.max;
  return (
    <>
      <p className="text-sm text-muted">{t("rewardsHint")}</p>
      {m.rewards.length > 0 && (
        <ul className="flex flex-col gap-2">
          {m.rewards.map((r) => (
            <Card key={r.id} label={r.title}>
              <span className="min-w-0 flex-1 font-bold [overflow-wrap:anywhere]">{r.title}</span>
              <Price n={r.cost} />
              <Button
                variant="secondary"
                disabled={busy !== null || s.coins < r.cost}
                aria-label={t("redeemLabel", { title: r.title, coins: r.cost })}
                onClick={() => void run(`redeem-${r.id}`, () => m.redeem(r.id))}
              >
                {t("redeem")}
              </Button>
              <Button
                variant="ghost"
                disabled={busy !== null}
                aria-label={t("removeLabel", { title: r.title })}
                onClick={() => void run(`rm-${r.id}`, () => m.removeReward(r.id))}
              >
                {t("remove")}
              </Button>
            </Card>
          ))}
        </ul>
      )}
      <form
        className="flex flex-col gap-2 rounded-xl bg-surface p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          void run("add-reward", async () => {
            const ok = await m.addReward(title, n);
            if (ok) setTitle("");
            return ok;
          });
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-bold">
          {t("rewardTitle")}
          <input
            value={title}
            maxLength={REWARD_TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("rewardPlaceholder")}
            className="min-h-11 rounded-xl bg-surface-2 px-3 font-normal"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          {t("rewardCost")}
          <input
            value={cost}
            inputMode="numeric"
            onChange={(e) => setCost(e.target.value.replace(/\D/g, ""))}
            className="min-h-11 rounded-xl bg-surface-2 px-3 font-normal tabular-nums"
          />
        </label>
        <Button type="submit" disabled={!valid || busy !== null}>
          {t("addReward")}
        </Button>
      </form>
    </>
  );
}
