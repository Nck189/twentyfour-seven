"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BlockKey, BlockSetting } from "@/content/blocks";
import { logEvent } from "@/lib/db/events";
import { getSupabase } from "@/lib/supabase/client";
import type { TemplateRow } from "@/lib/today/day";
import { NONE, type OnboardingState } from "./index";

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
  const blocksRef = useRef<BlockSetting[]>([]);
  const templatesRef = useRef<TemplateRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await client.auth.getUser();
      if (!auth.user) return;
      const [profile, settings, tpls] = await Promise.all([
        client.from("profiles").select("onboarding").eq("user_id", auth.user.id).maybeSingle(),
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

  return {
    status,
    error,
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
