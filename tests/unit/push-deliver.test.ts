import { describe, expect, it } from "vitest";
import { BATCH, deliver, type DueRow } from "../../supabase/functions/push-send/deliver";

const row = (user: string, ref: string, endpoint: string): DueRow => ({
  user_id: user,
  ref,
  title: "Focus starts now",
  body: "Open the thesis doc",
  endpoint,
  p256dh: "k",
  auth: "a",
});
const noDrop = async () => {};

describe("push sender core (M11)", () => {
  it("sends to every claimed device, drops gone devices, counts failures", async () => {
    const sent: string[] = [];
    const dropped: string[] = [];
    const r = await deliver(
      [
        row("u1", "night:d", "https://p/1"),
        row("u1", "night:d", "https://p/2"),
        row("u2", "wake:d", "https://p/3"),
        row("u3", "wake:d", "https://p/4"),
      ],
      {
        send: async (sub, payload) => {
          if (sub.endpoint.endsWith("/2")) throw Object.assign(new Error("gone"), { statusCode: 410 });
          if (sub.endpoint.endsWith("/4")) throw Object.assign(new Error("boom"), { statusCode: 500 });
          sent.push(`${sub.endpoint} ${JSON.parse(payload).title}`);
        },
        dropEndpoint: async (e) => void dropped.push(e),
      },
    );
    expect(sent.sort()).toEqual(["https://p/1 Focus starts now", "https://p/3 Focus starts now"]);
    expect(dropped).toEqual(["https://p/2"]);
    expect(r).toEqual({ sent: 2, gone: 1, failed: 1 });
  });

  it("G7 R-M11-1: a hanging device doesn't hold up the rest of its batch or the next batches", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const rows = Array.from({ length: BATCH * 2 + 3 }, (_, i) => row(`u${i}`, "night:d", `https://p/${i}`));
    const r = await deliver(rows, {
      send: async (sub) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        // The real send has a timeout; a slow one rejects like this instead of hanging forever.
        await new Promise((res) => setTimeout(res, 5));
        inFlight--;
        if (sub.endpoint.endsWith("/0")) throw Object.assign(new Error("timeout"), { code: "ETIMEDOUT" });
      },
      dropEndpoint: noDrop,
    });
    expect(maxInFlight).toBeGreaterThan(1);
    expect(maxInFlight).toBeLessThanOrEqual(BATCH);
    expect(r).toEqual({ sent: rows.length - 1, gone: 0, failed: 1 });
  });

  it("the payload opens Today and is tagged by reminder (a repeat replaces, never stacks)", async () => {
    let payload = "";
    await deliver([row("u", "block_start:d:focus", "https://p/x")], {
      send: async (_s, p) => void (payload = p),
      dropEndpoint: noDrop,
    });
    expect(JSON.parse(payload)).toEqual({
      title: "Focus starts now",
      body: "Open the thesis doc",
      tag: "block_start:d:focus",
      url: "/today",
    });
  });
});
