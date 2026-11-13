import { describe, expect, it, vi } from "vitest";
import { dedupeGets } from "@/lib/supabase/fetchWithTimeout";

/** Task #41: identical GETs in flight at once share one request (Today fired ~58 per load). */
const fakeFetch = () =>
  vi.fn(async (input: RequestInfo | URL) => {
    await new Promise((r) => setTimeout(r, 5));
    return new Response(JSON.stringify({ url: String(input) }), { status: 200 });
  });

describe("dedupeGets", () => {
  it("shares one request between identical GETs in flight; each caller can read the body", async () => {
    const base = fakeFetch();
    const f = dedupeGets(base as unknown as typeof fetch);
    const init = { headers: { Authorization: "Bearer a", apikey: "k" } };
    const [a, b] = await Promise.all([
      f("https://x/rest/v1/profiles?select=timezone", init),
      f("https://x/rest/v1/profiles?select=timezone", init),
    ]);
    expect(base).toHaveBeenCalledTimes(1);
    expect(await a.json()).toEqual({ url: "https://x/rest/v1/profiles?select=timezone" });
    expect(await b.json()).toEqual({ url: "https://x/rest/v1/profiles?select=timezone" });
  });

  it("never merges different tokens, other methods, requests with their own signal, or later requests", async () => {
    const base = fakeFetch();
    const f = dedupeGets(base as unknown as typeof fetch);
    const u = "https://x/rest/v1/game_state";
    await Promise.all([
      f(u, { headers: { Authorization: "Bearer a" } }),
      f(u, { headers: { Authorization: "Bearer b" } }),
      f(u, { method: "POST", headers: { Authorization: "Bearer a" }, body: "{}" }),
      f(u, { method: "POST", headers: { Authorization: "Bearer a" }, body: "{}" }),
      f(u, { headers: { Authorization: "Bearer a" }, signal: new AbortController().signal }),
    ]);
    expect(base).toHaveBeenCalledTimes(5);
    await f(u, { headers: { Authorization: "Bearer a" } }); // the earlier one finished: a fresh request
    expect(base).toHaveBeenCalledTimes(6);
  });

  it("a failure reaches every waiting caller, and the next request tries again", async () => {
    let n = 0;
    const base = vi.fn(async () => {
      n++;
      if (n === 1) throw new TypeError("network");
      return new Response("ok");
    });
    const f = dedupeGets(base as unknown as typeof fetch);
    const r = await Promise.allSettled([f("https://x/a"), f("https://x/a")]);
    expect(r.map((x) => x.status)).toEqual(["rejected", "rejected"]);
    expect(await (await f("https://x/a")).text()).toBe("ok");
  });

  it("G7 PERF P-1: a read that starts after a write never joins a read from before it", async () => {
    const base = fakeFetch();
    const f = dedupeGets(base as unknown as typeof fetch);
    const u = "https://x/rest/v1/game_state";
    const before = f(u);
    await f("https://x/rest/v1/rpc/pull_gacha", { method: "POST", body: "{}" });
    const after = f(u);
    await Promise.all([before, after]);
    expect(base).toHaveBeenCalledTimes(3);
  });

  it("many callers each read the body; Request inputs and HEAD counts keep their own key", async () => {
    const base = vi.fn(async () => new Response("[1]", { headers: { "content-range": "0-0/42" } }));
    const f = dedupeGets(base as unknown as typeof fetch);
    const rs = await Promise.all(Array.from({ length: 5 }, () => f("https://x/a")));
    expect(base).toHaveBeenCalledTimes(1);
    for (const r of rs) expect(await r.text()).toBe("[1]");
    const heads = await Promise.all([
      f("https://x/a", { method: "HEAD", headers: { Prefer: "count=exact" } }),
      f("https://x/a", { method: "HEAD", headers: { Prefer: "count=exact" } }),
    ]);
    expect(base).toHaveBeenCalledTimes(2);
    expect(heads.map((h) => h.headers.get("content-range"))).toEqual(["0-0/42", "0-0/42"]);
    await Promise.all([f(new Request("https://x/a")), f(new Request("https://x/a"))]);
    expect(base).toHaveBeenCalledTimes(4);
  });
});
