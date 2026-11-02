"use client";

import { useSyncExternalStore } from "react";

/**
 * Current time, refreshed every `intervalMs` (respects Playwright's fake clock).
 * Returns null during prerender/hydration so no clock value is baked into the static shell.
 * Subscribe functions are cached per interval: a new function each render would make React
 * resubscribe every render (and loop).
 */
type Store = {
  now: Date;
  listeners: Set<() => void>;
  id?: ReturnType<typeof setInterval>;
  subscribe: (cb: () => void) => () => void;
  getSnapshot: () => Date;
};

const stores = new Map<number, Store>();

function storeFor(intervalMs: number): Store {
  const existing = stores.get(intervalMs);
  if (existing) return existing;
  const s: Store = {
    now: new Date(),
    listeners: new Set(),
    subscribe: (cb) => {
      s.listeners.add(cb);
      if (!s.id) {
        s.id = setInterval(() => {
          s.now = new Date();
          s.listeners.forEach((l) => l());
        }, intervalMs);
      }
      return () => {
        s.listeners.delete(cb);
        if (s.listeners.size === 0 && s.id) {
          clearInterval(s.id);
          s.id = undefined;
        }
      };
    },
    getSnapshot: () => s.now,
  };
  stores.set(intervalMs, s);
  return s;
}

const serverSnapshot = () => null;

export function useNow(intervalMs = 30_000): Date | null {
  const s = storeFor(intervalMs);
  return useSyncExternalStore(s.subscribe, s.getSnapshot, serverSnapshot);
}
