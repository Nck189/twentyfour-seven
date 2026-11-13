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
});
