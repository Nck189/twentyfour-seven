import { localParts } from "@/lib/time";
import { SB_SERVICE_KEY, SB_URL } from "./env";

const H = {
  apikey: SB_SERVICE_KEY,
  Authorization: `Bearer ${SB_SERVICE_KEY}`,
  "Content-Type": "application/json",
};

export async function userIdFor(email: string): Promise<string> {
  const res = await fetch(`${SB_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, { headers: H });
  const body = (await res.json()) as { users: { id: string; email: string }[] };
  const u = body.users.find((x) => x.email === email);
  if (!u) throw new Error(`no user ${email}`);
  return u.id;
}

export async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...H, Prefer: "return=representation", ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Bangkok "HH:MM" for now + offset minutes. */
export function hhmmFromNow(offsetMin: number): string {
  const p = localParts(new Date(Date.now() + offsetMin * 60_000), "Asia/Bangkok");
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/**
 * Makes "now" land at a known point of the day: every template wakes `minutesAgo` before now,
 * with no fixed events or attend toggle.
 */
export async function setWakeMinutesAgo(userId: string, minutesAgo: number) {
  await rest(`templates?user_id=eq.${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ target_wake: hhmmFromNow(-minutesAgo), fixed_events: [], options: {} }),
  });
  await clearWakeSnapshots(userId);
}

/**
 * Test setup edits targets right before pressing, which the server treats as a late edit and
 * freezes the old target (anti-cheat). Clearing the snapshot makes the setup count as planned
 * long ago.
 */
export async function clearWakeSnapshots(userId: string) {
  await rest(`wake_snapshots?user_id=eq.${userId}`, { method: "DELETE" });
}

/** Gives a block a checklist in the user's settings. */
export async function setChecklist(userId: string, block: string, labels: string[]) {
  const [settings] = (await rest(`settings?user_id=eq.${userId}&select=blocks`)) as {
    blocks: { key: string; checklist: unknown[] }[];
  }[];
  const blocks = settings.blocks.map((b) =>
    b.key === block ? { ...b, checklist: labels.map((label, i) => ({ id: `${block}-${i}`, label })) } : b,
  );
  await rest(`settings?user_id=eq.${userId}`, { method: "PATCH", body: JSON.stringify({ blocks }) });
}

export async function blockLogs(userId: string) {
  return (await rest(`block_logs?user_id=eq.${userId}&select=*`)) as Record<string, unknown>[];
}

export async function gameState(userId: string) {
  const [g] = (await rest(`game_state?user_id=eq.${userId}&select=*`)) as Record<string, number>[];
  return g;
}

/** Same target wake (and optional fixed events) for every template, so any real date behaves the same. */
export async function setAllTemplates(
  userId: string,
  target: string,
  fixedEvents: { id: string; key: string; title: string | null; start: string; end: string }[] = [],
) {
  await rest(`templates?user_id=eq.${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ target_wake: target, fixed_events: fixedEvents, options: {} }),
  });
  await clearWakeSnapshots(userId);
}

export async function dayPlans(userId: string) {
  return (await rest(`day_plans?user_id=eq.${userId}&select=*`)) as Record<string, unknown>[];
}

/** Inserts a wake event for a past date via the user's backfill RPC equivalent (admin). */
export async function addWakeEvent(userId: string, date: string, inWindow: boolean) {
  await rest("wake_events", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      date,
      target_wake: new Date(Date.now() - 86400_000).toISOString(),
      pressed_at: new Date(Date.now() - 86400_000).toISOString(),
      in_window: inWindow,
      backfilled: false,
    }),
  });
}

/** Adds a backlog item directly (setup for M5 journeys). */
export async function addBacklogItem(userId: string, item: Record<string, unknown>) {
  const [row] = (await rest("backlog_items", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, ...item }),
  })) as Record<string, unknown>[];
  return row;
}

export async function backlogItems(userId: string) {
  return (await rest(`backlog_items?user_id=eq.${userId}&select=*&order=created_at`)) as Record<
    string,
    unknown
  >[];
}

export async function settingsBlocks(userId: string) {
  const [row] = (await rest(`settings?user_id=eq.${userId}&select=blocks`)) as {
    blocks: Record<string, unknown>[];
  }[];
  return row.blocks;
}

export async function profile(userId: string) {
  const [row] = (await rest(`profiles?user_id=eq.${userId}&select=*`)) as Record<string, unknown>[];
  return row;
}

export async function templates(userId: string) {
  return (await rest(`templates?user_id=eq.${userId}&select=*&order=sort`)) as Record<string, unknown>[];
}
