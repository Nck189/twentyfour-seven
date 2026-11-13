/**
 * M11 sender core (pure, no Deno/Node APIs; unit-tested in tests/unit/push-deliver.test.ts).
 * `push_claim` has already marked these reminders sent (one row per device), so this only sends:
 * in small parallel batches, each send bounded by the caller's timeout, so a slow or hanging
 * device never holds up anyone else (G7 R-M11-1). Devices the push service says are gone
 * (404/410) are dropped.
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
};

export const BATCH = 20;

export async function deliver(rows: readonly DueRow[], deps: Deps) {
  let sent = 0;
  let gone = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map((r) =>
        deps.send(
          { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
          JSON.stringify({ title: r.title, body: r.body, tag: r.ref, url: "/today" }),
        ),
      ),
    );
    for (let k = 0; k < results.length; k++) {
      const res = results[k]!;
      if (res.status === "fulfilled") {
        sent++;
        continue;
      }
      const status = (res.reason as { statusCode?: number } | undefined)?.statusCode;
      if (status === 404 || status === 410) {
        gone++;
        await deps.dropEndpoint(batch[k]!.endpoint);
      } else failed++;
    }
  }
  return { sent, gone, failed };
}
