/**
 * M11 sender core (pure, no Deno/Node APIs; unit-tested in tests/unit/push-deliver.test.ts):
 * send each due reminder to each of the user's devices, drop devices the push service says are
 * gone (404/410), and mark a reminder sent once all its devices were tried (never resent).
 */
export type DueRow = {
  user_id: string;
  ref: string;
  title: string;
  body: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};
export type Deps = {
  send: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string) => Promise<void>;
  dropEndpoint: (endpoint: string) => Promise<void>;
  markSent: (userId: string, ref: string) => Promise<void>;
};

export async function deliver(rows: readonly DueRow[], deps: Deps) {
  let sent = 0;
  let gone = 0;
  let failed = 0;
  const done = new Map<string, { user: string; ref: string }>();
  for (const r of rows) {
    const payload = JSON.stringify({ title: r.title, body: r.body, tag: r.ref, url: "/today" });
    try {
      await deps.send({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, payload);
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        gone++;
        await deps.dropEndpoint(r.endpoint);
      } else failed++;
    }
    done.set(`${r.user_id}|${r.ref}`, { user: r.user_id, ref: r.ref });
  }
  for (const d of done.values()) await deps.markSent(d.user, d.ref);
  return { sent, gone, failed, reminders: done.size };
}
