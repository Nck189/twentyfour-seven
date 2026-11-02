"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BlockKey } from "@/content/blocks";
import { logEvent } from "@/lib/db/events";
import { getSupabase } from "@/lib/supabase/client";
import { DEFAULT_BLOCK, carryOver, type BacklogItem } from "./index";

const COLUMNS =
  "id, title, tag, estimate_min, priority, deadline, scheduled_date, block, status, carry_count, checklist, done_at, created_at";

export type ItemPatch = Partial<
  Pick<BacklogItem, "title" | "tag" | "estimate_min" | "priority" | "deadline" | "checklist">
>;

/**
 * Backlog data (SPEC §5): everything not dropped, plus items finished in the last 14 days so a
 * day's capacity still counts them. Writes are optimistic and roll back with an error flag.
 */
export function useBacklog(userId: string | null) {
  const client = getSupabase();
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const itemsRef = useRef<BacklogItem[]>([]);

  const show = useCallback((next: BacklogItem[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
    client
      .from("backlog_items")
      .select(COLUMNS)
      .neq("status", "dropped")
      .or(`status.neq.done,done_at.gte.${since}`)
      .order("created_at")
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setStatus("error");
          return;
        }
        show((data ?? []) as BacklogItem[]);
        setStatus("ready");
      });
    return () => {
      cancelled = true;
    };
  }, [client, userId, reload, show]);

  /** Applies a change on screen at once; restores the previous list if the save fails. */
  const optimistic = useCallback(
    async (id: string, change: Partial<BacklogItem>, save: () => PromiseLike<{ error: unknown }>) => {
      const before = itemsRef.current;
      show(before.map((i) => (i.id === id ? { ...i, ...change } : i)));
      const { error: err } = await save();
      if (err) {
        show(before);
        setError(true);
        return false;
      }
      setError(false);
      return true;
    },
    [show],
  );

  const add = useCallback(
    async (title: string) => {
      const clean = title.trim();
      if (!clean || !userId) return;
      const { data, error: err } = await client
        .from("backlog_items")
        .insert({ user_id: userId, title: clean.slice(0, 500) })
        .select(COLUMNS)
        .single();
      if (err || !data) {
        setError(true);
        return;
      }
      setError(false);
      show([...itemsRef.current, data as BacklogItem]);
      void logEvent("backlog_item_added", { id: (data as BacklogItem).id });
    },
    [client, userId, show],
  );

  const update = useCallback(
    (id: string, patch: ItemPatch) =>
      optimistic(id, patch, () => client.from("backlog_items").update(patch).eq("id", id)),
    [client, optimistic],
  );

  /** Puts an item on a day (default block: Work), or back in the inbox with `date = null`. */
  const schedule = useCallback(
    async (id: string, date: string | null, block?: BlockKey) => {
      const current = itemsRef.current.find((i) => i.id === id);
      if (!current) return false;
      const change: Partial<BacklogItem> =
        date === null
          ? { scheduled_date: null, block: null, status: "inbox" }
          : { scheduled_date: date, block: block ?? current.block ?? DEFAULT_BLOCK, status: "scheduled" };
      const ok = await optimistic(id, change, () => client.from("backlog_items").update(change).eq("id", id));
      if (ok) void logEvent("backlog_item_scheduled", { id, date, block: change.block ?? null });
      return ok;
    },
    [client, optimistic],
  );

  /** Night ritual: carry an unfinished item to another day (or the inbox), counting the carry. */
  const carry = useCallback(
    async (id: string, to: string | null) => {
      const current = itemsRef.current.find((i) => i.id === id);
      if (!current) return false;
      const patch = carryOver(current, to);
      const ok = await optimistic(id, patch, () => client.from("backlog_items").update(patch).eq("id", id));
      if (ok) void logEvent("backlog_item_carried", { id, to, carry_count: patch.carry_count });
      return ok;
    },
    [client, optimistic],
  );

  /** Finish an item; coins are decided by the server. Returns the coins granted (0 if none). */
  const complete = useCallback(
    async (id: string): Promise<number | null> => {
      const before = itemsRef.current;
      show(
        before.map((i) => (i.id === id ? { ...i, status: "done", done_at: new Date().toISOString() } : i)),
      );
      const { data, error: err } = await client.rpc("complete_backlog_item", { p_id: id });
      if (err) {
        show(before);
        setError(true);
        return null;
      }
      setError(false);
      void logEvent("backlog_item_done", { id });
      return (data as { coins_granted: number }).coins_granted;
    },
    [client, show],
  );

  const reopen = useCallback(
    (id: string) => {
      const current = itemsRef.current.find((i) => i.id === id);
      const status = current?.scheduled_date ? "scheduled" : "inbox";
      return optimistic(id, { status, done_at: null }, () =>
        client.from("backlog_items").update({ status, done_at: null }).eq("id", id),
      );
    },
    [client, optimistic],
  );

  const drop = useCallback(
    async (id: string) => {
      const before = itemsRef.current;
      show(before.filter((i) => i.id !== id));
      const { error: err } = await client.from("backlog_items").update({ status: "dropped" }).eq("id", id);
      if (err) {
        show(before);
        setError(true);
        return;
      }
      void logEvent("backlog_item_dropped", { id });
    },
    [client, show],
  );

  return {
    items,
    status,
    error,
    add,
    update,
    schedule,
    carry,
    complete,
    reopen,
    drop,
    reload: () => setReload((r) => r + 1),
  };
}
