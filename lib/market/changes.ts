"use client";

/**
 * "Coins or stock changed somewhere else" (a harvest, collecting produce, buying decor, planting a
 * bought seed): the farm Shop listens and reloads, so it never shows a stale shelf or coin count
 * (G7 ECON E2/E3). A plain window event: no state library needed for one signal.
 */
const EVENT = "247:wallet-changed";

export function notifyWalletChange(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function onWalletChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}
