/**
 * Check-ins that couldn't be saved survive closing the app (M14, Minnie 2026-11-02: "a persistent
 * offline queue for check-ins"). Each pending save is plain data (no closures), kept per user in
 * localStorage, replayed in order on the next open with a connection. Pure except `execReq`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type SaveReq =
  | { t: "upsert"; row: Record<string, unknown> }
  /** A checklist tick: optionally create the (backfilled) log first, then toggle atomically. */
  | { t: "item"; pre: Record<string, unknown> | null; args: Record<string, unknown> };

export type PendingOp<Log = unknown> = {
  key: string;
  next: Log;
  req: SaveReq;
  event: [string, Record<string, unknown>];
  /** When the action happened (ISO). */
  at: string;
};

/** Older pending saves are dropped: a week-old check-in isn't worth guessing about. */
export const MAX_AGE_DAYS = 7;
const storageKey = (userId: string) => `24-7:pending-saves:${userId}`;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function writePending(store: Store | null, userId: string, ops: readonly PendingOp[]): void {
  if (!store) return;
  try {
    if (ops.length === 0) store.removeItem(storageKey(userId));
    else store.setItem(storageKey(userId), JSON.stringify(ops));
  } catch {
    // storage full or blocked: the in-memory queue still works for this visit
  }
}

const isOp = (o: unknown): o is PendingOp => {
  if (!o || typeof o !== "object") return false;
  const x = o as Record<string, unknown>;
  const req = x.req as Record<string, unknown> | undefined;
  return (
    typeof x.key === "string" &&
    typeof x.at === "string" &&
    Array.isArray(x.event) &&
    !!req &&
    (req.t === "upsert" ? typeof req.row === "object" : req.t === "item" && typeof req.args === "object")
  );
};

export function readPending(store: Store | null, userId: string, now: Date): PendingOp[] {
  if (!store) return [];
  try {
    const raw = store.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const oldest = now.getTime() - MAX_AGE_DAYS * 86_400_000;
    return parsed.filter(isOp).filter((o) => Date.parse(o.at) >= oldest);
  } catch {
    return [];
  }
}

/** A refusal from Postgres itself (SQLSTATE, e.g. a check failed): retrying won't help. */
export function isPermanent(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[0-9A-Z]{5}$/.test(code);
}

export async function execReq(
  client: SupabaseClient,
  req: SaveReq,
): Promise<{ data: unknown; error: unknown }> {
  if (req.t === "upsert")
    return client.from("block_logs").upsert(req.row, { onConflict: "user_id,date,block" }).select().single();
  if (req.pre) {
    const first = await client.from("block_logs").upsert(req.pre, { onConflict: "user_id,date,block" });
    if (first.error) return first;
  }
  return client.rpc("set_block_item", req.args);
}
