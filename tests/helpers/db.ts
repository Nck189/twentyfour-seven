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
