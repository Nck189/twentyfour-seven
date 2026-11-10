"use client";

import { useCallback, useEffect } from "react";
import { create } from "zustand";
import { isTipId, type TipId } from "@/content/tips";
import { logEvent } from "@/lib/db/events";
import { getSupabase } from "@/lib/supabase/client";
import { activeTip } from "./tips";

type TipsState = {
  /** Unknown until the profile answers (or forever before the M10 migration): no tips then. */
  loaded: boolean;
  seen: Set<TipId>;
  off: boolean;
  mounted: Set<TipId>;
  dismissedThisVisit: boolean;
  load: () => Promise<void>;
  mount: (id: TipId) => void;
  unmount: (id: TipId) => void;
  dismiss: (id: TipId) => void;
  skipAll: () => void;
  showAgain: () => Promise<void>;
  newVisit: () => void;
};

let loading: Promise<void> | null = null;

async function save(patch: { tips_seen?: TipId[]; tips_off?: boolean }) {
  const client = getSupabase();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return;
  await client.from("profiles").update(patch).eq("user_id", auth.user.id);
}

/**
 * First-time tips (BUILD_PLAN M10): what each account has seen, kept on the profile so a tip
 * seen on the phone doesn't come back on the Mac.
 */
export const useTipsStore = create<TipsState>()((set, get) => ({
  loaded: false,
  seen: new Set(),
  off: false,
  mounted: new Set(),
  dismissedThisVisit: false,
  load: () => {
    loading ??= (async () => {
      const client = getSupabase();
      const { data: auth } = await client.auth.getUser();
      if (!auth.user) {
        loading = null; // not signed in yet: ask again on the next screen
        return;
      }
      const { data, error } = await client
        .from("profiles")
        .select("tips_seen, tips_off")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (error || !data) return; // e.g. before the migration: no tips rather than errors
      const row = data as { tips_seen: string[] | null; tips_off: boolean | null };
      set({
        loaded: true,
        seen: new Set((row.tips_seen ?? []).filter(isTipId)),
        off: !!row.tips_off,
      });
    })().catch(() => {
      loading = null;
    });
    return loading;
  },
  mount: (id) => set((s) => ({ mounted: new Set(s.mounted).add(id) })),
  unmount: (id) =>
    set((s) => {
      const m = new Set(s.mounted);
      m.delete(id);
      return { mounted: m };
    }),
  dismiss: (id) => {
    const seen = new Set(get().seen).add(id);
    set({ seen, dismissedThisVisit: true });
    void save({ tips_seen: [...seen] });
    void logEvent("tip_dismissed", { tip: id });
  },
  skipAll: () => {
    set({ off: true });
    void save({ tips_off: true });
    void logEvent("tips_skipped");
  },
  showAgain: async () => {
    set({ seen: new Set(), off: false, dismissedThisVisit: false });
    await save({ tips_seen: [], tips_off: false });
    void logEvent("tips_reset");
  },
  newVisit: () => set({ dismissedThisVisit: false }),
}));

/** Registers a tip spot while `when` is true and says whether its bubble shows now. */
export function useTip(id: TipId, when = true) {
  const { loaded, seen, off, mounted, dismissedThisVisit, load, mount, unmount, dismiss, skipAll } =
    useTipsStore();
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!when) return;
    mount(id);
    return () => unmount(id);
  }, [id, when, mount, unmount]);
  const show = loaded && when && activeTip(mounted, seen, off, dismissedThisVisit) === id;
  const dismissThis = useCallback(() => dismiss(id), [dismiss, id]);
  return { show, dismiss: dismissThis, skipAll };
}
