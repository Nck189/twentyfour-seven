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
  /** Replays the server answered but refused for a retryable reason (R-M14-1). */
  tries?: number;
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

const codeOf = (error: unknown): string => {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : "";
};

/**
 * Retrying can't help: bad data or a rule (SQLSTATE classes 22 and 23, a function's own
 * `raise` P0001), or a request the API can't map any more (PGRST1xx/2xx, e.g. an RPC whose
 * parameters changed in a later deploy). An explicit list (G7 R-M14-1): anything else, such as
 * 42501 from an expired token sent with the anon key, a timeout or a conflict, is retried.
 */
export function isPermanent(error: unknown): boolean {
  const code = codeOf(error);
  return /^(22|23)[0-9A-Z]{3}$/.test(code) || code === "P0001" || /^PGRST[12]\d\d$/.test(code);
}

/** A save the server keeps refusing for a retryable reason is dropped after this many tries. */
export const MAX_TRIES = 5;

/**
 * What a replay does with a failed save: drop it (final, or tried too often), keep it for later
 * without holding up the rest (the server answered but refused), or stop (no answer: offline).
 */
export function replayDecision(error: unknown, tries: number): "drop" | "keep" | "stop" {
  if (isPermanent(error)) return "drop";
  if (!codeOf(error)) return "stop";
  return tries + 1 >= MAX_TRIES ? "drop" : "keep";
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
