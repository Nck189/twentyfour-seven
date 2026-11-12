import { describe, expect, it } from "vitest";
import { deliver, type DueRow } from "../../supabase/functions/push-send/deliver";

const row = (user: string, ref: string, endpoint: string): DueRow => ({
  user_id: user,
  ref,
  title: "Focus starts now",
  body: "Open the thesis doc",
  endpoint,
  p256dh: "k",
  auth: "a",
});

describe("push sender core (M11)", () => {
  it("sends to every device, drops gone devices, marks each reminder sent once", async () => {
    const sent: string[] = [];
    const dropped: string[] = [];
    const marked: string[] = [];
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
        markSent: async (u, ref) => void marked.push(`${u}|${ref}`),
      },
    );
    expect(sent).toEqual(["https://p/1 Focus starts now", "https://p/3 Focus starts now"]);
    expect(dropped).toEqual(["https://p/2"]);
    expect(marked).toEqual(["u1|night:d", "u2|wake:d", "u3|wake:d"]);
    expect(r).toEqual({ sent: 2, gone: 1, failed: 1, reminders: 3 });
  });

  it("the payload opens Today and is tagged by reminder (a repeat replaces, never stacks)", async () => {
    let payload = "";
    await deliver([row("u", "block_start:d:focus", "https://p/x")], {
      send: async (_s, p) => void (payload = p),
      dropEndpoint: async () => {},
      markSent: async () => {},
    });
    expect(JSON.parse(payload)).toEqual({
      title: "Focus starts now",
      body: "Open the thesis doc",
      tag: "block_start:d:focus",
      url: "/today",
    });
  });
});
