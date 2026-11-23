/**
 * Big buys ask first (Minnie 2026-11-23: "confirm big buys only"). Seeds and small decor buy in
 * one tap; anything at or over BIG_BUY coins, or a quarter or more of what you have, asks first.
 */
export const BIG_BUY = 100;

export function needsConfirm(price: number, coins: number): boolean {
  if (price <= 0) return false;
  return price >= BIG_BUY || price * 4 >= coins;
}
