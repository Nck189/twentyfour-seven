"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Coin } from "@/components/art/Coin";
import { TicketArt } from "@/components/art/Ticket";
import { CropArt } from "@/components/art/farm/CropArt";
import { ProduceArt } from "@/components/art/farm/Animals";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import {
  REWARD_COST,
  REWARD_TITLE_MAX,
  UPGRADE_PRICES,
  UPGRADE_TRACKS,
  WEATHER_PRICE_CAP,
  type UpgradeTrack,
} from "@/content/economy";
import type { DecorId } from "@/content/decor";
import type { Season } from "@/content/seasons";
import { nextUpgradePrice, parseItem } from "@/lib/game/market";
import { notifyWalletChange } from "@/lib/market/changes";
import { useMarket, type ActResult, type MarketStatus } from "@/lib/market/useMarket";
import { sfx } from "@/lib/sound/sfx";
import { usePrefs } from "@/lib/store/prefs";
import { DecorShop } from "./DecorShop";

type Tab = "market" | "shop" | "upgrades" | "rewards";
/** What the last action got the player (shown as a small payoff line; G7 ECON E5). */
type Notice = { text: string; coins?: number };

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
  const [failed, setFailed] = useState<"refused" | "network" | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const s = m.status;
  const clearNotice = useCallback(() => setNotice(null), []);

  const run: Run = async (key, action, payoff) => {
    setBusy(key);
    setFailed(null);
    setNotice(null);
    const r = await action();
    setBusy(null);
    if (r.ok) {
      const n = payoff?.(r);
      if (n?.coins && n.coins > 0) sfx.harvest();
      else sfx.tick();
      setNotice(n ?? null);
      onChanged();
      notifyWalletChange();
    } else setFailed(r.refused ? "refused" : "network");
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
        onChange={(v) => {
          setTab(v);
          setNotice(null);
          setFailed(null);
          m.reload();
        }}
        compact
        options={[
          { value: "market", label: t("tab.market") },
          { value: "shop", label: t("tab.shop") },
          { value: "upgrades", label: t("tab.upgrades") },
          { value: "rewards", label: t("tab.rewardsShort") },
        ]}
      />
      <Payoff notice={notice} onDone={clearNotice} />
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
          {t(failed === "refused" ? "refused" : "actionError")}
        </p>
      )}
    </section>
  );
}

type Run = (
  key: string,
  action: () => Promise<ActResult>,
  payoff?: (r: ActResult) => Notice,
) => Promise<void>;

type TabProps = {
  s: MarketStatus;
  busy: string | null;
  run: Run;
  m: ReturnType<typeof useMarket>;
};

/**
 * The payoff of the last action: a coin pop and one line (still with reduced motion). It floats
 * over the page: an in-flow line that appears and leaves shifts the rows under a finger, so a
 * quick next tap lands on the wrong button (CI, iPhone WebKit).
 */
function Payoff({ notice, onDone }: { notice: Notice | null; onDone: () => void }) {
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(onDone, 2600);
    return () => clearTimeout(id);
  }, [notice, onDone]);
  const reduce = useReducedMotion();
  const skip = usePrefs((p) => p.skipAnimations) || Boolean(reduce);
  // Only the latest payoff exists (no exit animation that would leave old ones around).
  if (!notice) return null;
  return (
    <motion.p
      key={notice.text}
      role="status"
      className="pointer-events-none fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-50 mx-auto flex max-w-md items-center gap-2 rounded-xl bg-primary-soft p-3 font-bold text-primary"
      initial={skip ? false : { opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      {notice.coins !== undefined && (
        <motion.span
          aria-hidden="true"
          className="inline-flex"
          initial={skip ? false : { scale: 0.3, rotate: -40 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 12 }}
        >
          <Coin className="h-6 w-6" />
        </motion.span>
      )}
      <span className="min-w-0 flex-1 break-words">{notice.text}</span>
    </motion.p>
  );
}

function Price({ n }: { n: number }) {
  return (
    <span className="flex shrink-0 items-center gap-0.5 text-sm font-bold" aria-hidden="true">
      <Coin className="h-4 w-4" />
      {n}
    </span>
  );
}

/** A two-line row: picture, name and price on top; actions below (nothing gets squeezed). */
function Row({ label, top, actions }: { label: string; top: ReactNode; actions: ReactNode }) {
  return (
    <li aria-label={label} className="flex flex-col gap-2 rounded-xl bg-surface p-2 pr-3">
      <div className="flex items-center gap-3">{top}</div>
      <div className="flex flex-wrap justify-end gap-2">{actions}</div>
    </li>
  );
}

const earned = (r: ActResult) => Number(r.data?.earned ?? 0);

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
          const name = t("order", { n: o.qty, crop: crops(o.crop) });
          return (
            <Row
              key={o.slot}
              label={name}
              top={
                <>
                  <CropArt cropId={o.crop} stage={3} status="ready" className="h-11 w-11 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold break-words">{name}</span>
                    <span className="text-xs text-muted">{t("orderHave", { n: have(o.crop) })}</span>
                  </span>
                </>
              }
              actions={
                o.done ? (
                  <span className="text-sm font-bold text-primary">{t("delivered")}</span>
                ) : (
                  <Button
                    variant="secondary"
                    disabled={!enough || busy !== null}
                    onClick={() =>
                      void run(
                        `order-${o.slot}`,
                        () => m.deliver(o.slot),
                        (r) => ({ text: t("paidDelivered", { n: earned(r) }), coins: earned(r) }),
                      )
                    }
                  >
                    {t("deliver", { coins: o.coins })}
                  </Button>
                )
              }
            />
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
            // The weather bonus as the market counts it (capped), so the label matches the price.
            const counted = it.kind === "crop" ? Math.min(it.mult, WEATHER_PRICE_CAP) : 1;
            return (
              <Row
                key={x.item}
                label={name}
                top={
                  <>
                    {it.kind === "crop" ? (
                      <CropArt cropId={it.cropId} stage={3} status="ready" className="h-11 w-11 shrink-0" />
                    ) : (
                      <ProduceArt id={it.id} className="h-11 w-11 shrink-0" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold break-words">
                        {name} <span className="text-muted">×{x.qty}</span>
                      </span>
                      {it.kind === "crop" && (
                        <span className="text-xs text-muted">
                          {tf(`qualityName.${it.quality}`)}
                          {counted > 1 && ` · ${tf("multiplier", { n: Math.round(counted * 10) / 10 })}`}
                        </span>
                      )}
                    </span>
                    <Price n={x.price} />
                  </>
                }
                actions={
                  <>
                    {x.qty > 1 && (
                      <Button
                        variant="ghost"
                        disabled={busy !== null}
                        aria-label={t("sellAllLabel", { item: name, coins: x.price * x.qty })}
                        onClick={() =>
                          void run(
                            `sellall-${x.item}`,
                            () => m.sell(x.item, x.qty),
                            (r) => ({ text: t("paidSold", { n: earned(r) }), coins: earned(r) }),
                          )
                        }
                      >
                        {t("sellAll")}
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      disabled={busy !== null}
                      aria-label={t("sellOne", { item: name, coins: x.price })}
                      onClick={() =>
                        void run(
                          `sell-${x.item}`,
                          () => m.sell(x.item, 1),
                          (r) => ({ text: t("paidSold", { n: earned(r) }), coins: earned(r) }),
                        )
                      }
                    >
                      {t("sell")}
                    </Button>
                  </>
                }
              />
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
              onClick={() =>
                void run(
                  `seed-${x.crop}`,
                  () => m.buySeed(x.crop),
                  () => ({ text: t("boughtSeed", { crop: crops(x.crop) }) }),
                )
              }
              className="tap flex min-h-11 w-full flex-col items-center rounded-xl bg-surface p-2 disabled:opacity-50"
            >
              <CropArt cropId={x.crop} stage={3} status="ready" className="h-12 w-12" />
              <span className="text-xs font-bold break-words">{crops(x.crop)}</span>
              <Price n={x.price} />
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">{t("seedsHint")}</p>
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface p-3">
        <TicketArt className="h-10 w-14 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block font-bold">{t("exchangeTitle", { coins: s.exchange.price })}</span>
          <span className="text-xs text-muted">{t("exchangeLeft", { n: left, max: s.exchange.max })}</span>
        </span>
        <Button
          variant="secondary"
          disabled={busy !== null || left <= 0 || s.coins < s.exchange.price}
          onClick={() => void run("exchange", m.exchange, () => ({ text: t("gotTicket") }))}
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
        const max = UPGRADE_PRICES[track].length;
        return (
          <li key={track} className="flex flex-col gap-2 rounded-xl bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold">{t(`upgrade.${track}.name`)}</span>
              <span className="text-sm text-muted">{t("levelOf", { n: level, max })}</span>
            </div>
            <p className="text-sm text-muted">{t(`upgrade.${track}.effect`)}</p>
            <div className="flex gap-1" aria-hidden="true">
              {Array.from({ length: max }, (_, i) => (
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
                onClick={() =>
                  void run(
                    `up-${track}`,
                    () => m.upgrade(track),
                    () => ({ text: t("upgraded", { name: t(`upgrade.${track}.name`), n: level + 1 }) }),
                  )
                }
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
  // Spending real savings is a two-tap action: first tap asks, second confirms (G7 S3).
  const [confirming, setConfirming] = useState<string | null>(null);
  const n = Number(cost);
  const valid =
    title.trim().length > 0 && Number.isInteger(n) && n >= REWARD_COST.min && n <= REWARD_COST.max;
  return (
    <>
      <p className="text-sm text-muted">{t("rewardsHint")}</p>
      {m.rewards.length > 0 && (
        <ul className="flex flex-col gap-2">
          {m.rewards.map((r) => (
            <Row
              key={r.id}
              label={r.title}
              top={
                <>
                  <span className="min-w-0 flex-1 font-bold break-words">{r.title}</span>
                  <Price n={r.cost} />
                </>
              }
              actions={
                confirming === r.id ? (
                  <>
                    <Button
                      disabled={busy !== null || s.coins < r.cost}
                      onClick={() => {
                        setConfirming(null);
                        void run(
                          `redeem-${r.id}`,
                          () => m.redeem(r.id),
                          () => ({ text: t("enjoy", { title: r.title, n: r.cost }), coins: 0 }),
                        );
                      }}
                    >
                      {t("confirmRedeem", { n: r.cost })}
                    </Button>
                    {/* Where "Redeem" was: a double-tap lands on Cancel, not on spending (G7 N2). */}
                    <Button variant="secondary" onClick={() => setConfirming(null)}>
                      {t("cancel")}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      disabled={busy !== null}
                      aria-label={t("removeLabel", { title: r.title })}
                      onClick={() => void run(`rm-${r.id}`, () => m.removeReward(r.id))}
                    >
                      {t("remove")}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy !== null || s.coins < r.cost}
                      aria-label={t("redeemLabel", { title: r.title, coins: r.cost })}
                      onClick={() => setConfirming(r.id)}
                    >
                      {t("redeem")}
                    </Button>
                  </>
                )
              }
            />
          ))}
        </ul>
      )}
      <form
        className="flex flex-col gap-2 rounded-xl bg-surface p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          void run("add-reward", async () => {
            const r = await m.addReward(title, n);
            if (r.ok) setTitle("");
            return r;
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
