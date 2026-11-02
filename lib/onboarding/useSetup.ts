"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BlockKey, BlockSetting } from "@/content/blocks";
import type { FixedEvent } from "@/content/defaults";
import type { Starter } from "@/content/starters";
import { logEvent } from "@/lib/db/events";
import { getSupabase } from "@/lib/supabase/client";
import { DEFAULT_TZ } from "@/lib/time";
import type { TemplateRow } from "@/lib/today/day";
import { NONE, type OnboardingState } from "./index";
import type { Kind } from "./schedule";

/**
 * Data for the first-run setup and its "edit later" entries in More: sleep times per kind of
 * day (templates), which weekdays use which kind, and each block's first-10. Saves at once.
 */
export function useSetup() {
  const client = getSupabase();
  const [userId, setUserId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [blocks, setBlocks] = useState<BlockSetting[]>([]);
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState(false);
  /** Bumps after bulk changes (starter, import, same sleep for all) so editors re-read values. */
  const [version, setVersion] = useState(0);
  const [timezone, setTimezone] = useState(DEFAULT_TZ);
  const blocksRef = useRef<BlockSetting[]>([]);
  const templatesRef = useRef<TemplateRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await client.auth.getUser();
      if (!auth.user) return;
      const [profile, settings, tpls] = await Promise.all([
        client.from("profiles").select("onboarding, timezone").eq("user_id", auth.user.id).maybeSingle(),
        client.from("settings").select("blocks").eq("user_id", auth.user.id).single(),
        client.from("templates").select("*").order("sort"),
      ]);
      if (cancelled) return;
      if (settings.error || tpls.error) {
        setStatus("error");
        return;
      }
      setUserId(auth.user.id);
      blocksRef.current = settings.data.blocks as BlockSetting[];
      templatesRef.current = tpls.data as TemplateRow[];
      setBlocks(blocksRef.current);
      setTemplates(templatesRef.current);
      setOnboarding((profile.data?.onboarding as OnboardingState) ?? {});
      setTimezone((profile.data?.timezone as string) ?? DEFAULT_TZ);
      setStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  const saveBlocks = useCallback(
    async (next: BlockSetting[]) => {
      const before = blocksRef.current;
      blocksRef.current = next;
      setBlocks(next);
      if (!userId) return;
      const { error: err } = await client.from("settings").update({ blocks: next }).eq("user_id", userId);
      if (err) {
        blocksRef.current = before;
        setBlocks(before);
      }
      setError(Boolean(err));
    },
    [client, userId],
  );

  const patchTemplate = useCallback(
    async (id: string, patch: Partial<TemplateRow>) => {
      const before = templatesRef.current;
      templatesRef.current = before.map((t) => (t.id === id ? { ...t, ...patch } : t));
      setTemplates(templatesRef.current);
      const { error: err } = await client.from("templates").update(patch).eq("id", id);
      if (err) {
        templatesRef.current = before;
        setTemplates(before);
      }
      setError(Boolean(err));
    },
    [client],
  );

  /** Wake time + sleep length for one kind of day (bedtime follows: wake − sleep). */
  const setSleep = useCallback(
    (id: string, wake: string, sleepMin: number) => {
      const tpl = templatesRef.current.find((t) => t.id === id);
      if (!tpl) return;
      void patchTemplate(id, {
        target_wake: wake,
        blocks: { ...tpl.blocks, sleep: { ...tpl.blocks?.sleep, duration_min: sleepMin } },
      });
    },
    [patchTemplate],
  );

  /** Moves a weekday to another kind of day (each weekday belongs to exactly one). */
  const moveWeekday = useCallback(
    async (day: number, toId: string) => {
      for (const t of templatesRef.current.filter((x) => x.auto_apply)) {
        const has = t.weekdays.includes(day);
        if (t.id === toId && !has) await patchTemplate(t.id, { weekdays: [...t.weekdays, day].sort() });
        if (t.id !== toId && has)
          await patchTemplate(t.id, { weekdays: t.weekdays.filter((d) => d !== day) });
      }
    },
    [patchTemplate],
  );

  const setFirst10 = useCallback(
    (key: BlockKey, value: string | null) =>
      saveBlocks(blocksRef.current.map((b) => (b.key === key ? { ...b, first10: value } : b))),
    [saveBlocks],
  );

  /** Adds an own first-10 text to a block's choices and makes it the default. */
  const addOwnFirst10 = useCallback(
    (key: BlockKey, text: string) => {
      const clean = text.trim().slice(0, 200);
      if (!clean) return Promise.resolve();
      return saveBlocks(
        blocksRef.current.map((b) =>
          b.key === key
            ? { ...b, first10: clean, first10_options: [...new Set([...(b.first10_options ?? []), clean])] }
            : b,
        ),
      );
    },
    [saveBlocks],
  );

  /** "No first-10 at all" switch: off → every block "", on → back to the built-in defaults. */
  const setUseFirst10 = useCallback(
    (on: boolean) =>
      saveBlocks(
        blocksRef.current.map((b) => ({
          ...b,
          first10: on ? (b.first10 === NONE ? null : b.first10) : NONE,
        })),
      ),
    [saveBlocks],
  );

  const finish = useCallback(
    async (how: "done" | "skipped") => {
      // Merge: the same jsonb also remembers other first-run facts (e.g. locale_set).
      const state: OnboardingState = { ...onboarding, [how]: true, at: new Date().toISOString() };
      setOnboarding(state);
      if (userId) await client.from("profiles").update({ onboarding: state }).eq("user_id", userId);
      void logEvent(how === "done" ? "onboarding_done" : "onboarding_skipped", {});
    },
    [client, userId, onboarding],
  );

  const reloadTemplates = useCallback(async () => {
    const { data, error: err } = await client.from("templates").select("*").order("sort");
    if (!err && data) {
      templatesRef.current = data as TemplateRow[];
      setTemplates(templatesRef.current);
      setVersion((v) => v + 1);
    }
    setError(Boolean(err));
  }, [client]);

  /**
   * Replaces the auto-applied kinds of day with `kinds` (upsert by key). Older kinds are kept
   * (day plans may point at them) but stop claiming weekdays.
   */
  const replaceKinds = useCallback(
    async (
      kinds: {
        key: string;
        name: string | null;
        weekdays: number[];
        wake: string;
        sleepMin: number;
        events: FixedEvent[];
      }[],
    ) => {
      if (!userId) return;
      const keep = new Set(kinds.map((k) => k.key));
      const off = templatesRef.current.filter((t) => t.auto_apply && !keep.has(t.key));
      await Promise.all(
        off.map((t) => client.from("templates").update({ auto_apply: false, weekdays: [] }).eq("id", t.id)),
      );
      const { error: err } = await client.from("templates").upsert(
        kinds.map((k, i) => ({
          user_id: userId,
          key: k.key,
          name: k.name,
          weekdays: k.weekdays,
          auto_apply: true,
          target_wake: k.wake,
          options: {},
          blocks: { sleep: { duration_min: k.sleepMin } },
          fixed_events: k.events,
          sort: i + 1,
        })),
        { onConflict: "user_id,key" },
      );
      setError(Boolean(err));
      await reloadTemplates();
    },
    [client, reloadTemplates, userId],
  );

  /** One tap: kinds of day + first-10 picks from a starter (blocks without a pick keep theirs). */
  const applyStarter = useCallback(
    async (starter: Starter) => {
      await replaceKinds(starter.kinds.map((k) => ({ ...k, name: null })));
      await saveBlocks(
        blocksRef.current.map((b) =>
          b.first10 === null && starter.first10[b.key] !== undefined
            ? { ...b, first10: starter.first10[b.key]! }
            : b,
        ),
      );
      void logEvent("onboarding_starter", { starter: starter.key });
    },
    [replaceKinds, saveBlocks],
  );

  /** From an .ics import: each group of weekdays with the same slots becomes a kind of day. */
  const applyWeekKinds = useCallback(
    async (kinds: Kind[], nameFor: (k: Kind, i: number) => string) => {
      await replaceKinds(
        kinds.map((k, i) => {
          const first = k.events[0]?.start;
          // Wake 1.5 h before the first slot (rounded down to 15 min), else 08:00.
          const wakeMin = first
            ? Math.max(
                5 * 60,
                Math.floor((Number(first.slice(0, 2)) * 60 + Number(first.slice(3)) - 90) / 15) * 15,
              )
            : 8 * 60;
          const wake = `${String(Math.floor(wakeMin / 60)).padStart(2, "0")}:${String(wakeMin % 60).padStart(2, "0")}`;
          return {
            key: k.events.length ? `sched_${i + 1}` : "day_off",
            name: k.events.length ? nameFor(k, i) : null,
            weekdays: k.weekdays,
            wake,
            sleepMin: 480,
            events: k.events.map((e, j) => ({
              id: `ics-${i}-${j}`,
              key: "class",
              title: e.title || null,
              start: e.start,
              end: e.end,
            })),
          };
        }),
      );
      void logEvent("onboarding_ics_imported", { kinds: kinds.length });
    },
    [replaceKinds],
  );

  /** A new, empty kind of day (move weekdays into it with the dots). */
  const addKind = useCallback(
    async (name: string) => {
      if (!userId) return;
      const base = templatesRef.current.find((t) => t.auto_apply);
      const { error: err } = await client.from("templates").insert({
        user_id: userId,
        key: `kind_${Date.now().toString(36)}`,
        name,
        weekdays: [],
        auto_apply: true,
        target_wake: base?.target_wake ?? "08:00",
        options: {},
        blocks: base?.blocks?.sleep ? { sleep: base.blocks.sleep } : {},
        fixed_events: [],
        sort: templatesRef.current.length + 1,
      });
      setError(Boolean(err));
      await reloadTemplates();
    },
    [client, reloadTemplates, userId],
  );

  const setEvents = useCallback(
    (id: string, events: FixedEvent[]) => void patchTemplate(id, { fixed_events: events }),
    [patchTemplate],
  );

  /** Same bed/wake for every kind of day. */
  const setAllSleep = useCallback(
    async (wake: string, sleepMin: number) => {
      for (const t of templatesRef.current.filter((x) => x.auto_apply)) {
        await patchTemplate(t.id, {
          target_wake: wake,
          blocks: { ...t.blocks, sleep: { ...t.blocks?.sleep, duration_min: sleepMin } },
        });
      }
      setVersion((v) => v + 1);
    },
    [patchTemplate],
  );

  return {
    status,
    error,
    version,
    timezone,
    applyStarter,
    applyWeekKinds,
    addKind,
    setEvents,
    setAllSleep,
    templates,
    blocks,
    onboarding,
    setSleep,
    moveWeekday,
    setFirst10,
    addOwnFirst10,
    setUseFirst10,
    finish,
  };
}
