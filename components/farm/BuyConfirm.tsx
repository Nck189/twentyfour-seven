"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Coin } from "@/components/art/Coin";
import { Sheet } from "@/components/today/BlockSheet";
import { Button } from "@/components/ui/Button";
import { needsConfirm } from "@/lib/economy/confirm";

/**
 * Big buys ask first (Minnie 2026-11-23): `buy(price, what, go)` runs `go` at once for a small
 * buy, or opens a sheet with the price and the coins left after. `sheet` goes anywhere in the
 * caller's tree. The server still decides the price; this only asks.
 */
export function useBuyConfirm(coins: number): {
  buy: (price: number, what: string, go: () => void) => void;
  sheet: ReactNode;
} {
  const t = useTranslations("shop.confirm");
  const [ask, setAsk] = useState<{ price: number; what: string; go: () => void } | null>(null);
  const buy = (price: number, what: string, go: () => void) =>
    needsConfirm(price, coins) ? setAsk({ price, what, go }) : go();
  const sheet = ask ? (
    <Sheet title={t("title")} onClose={() => setAsk(null)}>
      <p className="mb-4">{t("body", { what: ask.what, price: ask.price, left: coins - ask.price })}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setAsk(null)}>
          {t("cancel")}
        </Button>
        <Button
          onClick={() => {
            const go = ask.go;
            setAsk(null);
            go();
          }}
        >
          <Coin className="h-4 w-4" />
          {t("buy", { price: ask.price })}
        </Button>
      </div>
    </Sheet>
  ) : null;
  return { buy, sheet };
}
