import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout } from "@/lib/supabase/fetchWithTimeout";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** A fetch that never answers unless aborted. */
const hanging = () =>
  vi.fn(
    (_: unknown, init?: RequestInit) =>
      new Promise<Response>((_, reject) =>
        init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)),
      ),
  );

describe("fetchWithTimeout (no endless 'Loading…')", () => {
  it("a request that never answers fails after the deadline", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", hanging());
    const p = fetchWithTimeout(1000)("https://x.test");
    const caught = p.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(1001);
    expect(await caught).toMatchObject({ name: "TimeoutError" });
  });
  it("answers normally when the network does", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("ok")),
    );
    expect(await (await fetchWithTimeout(1000)("https://x.test")).text()).toBe("ok");
  });
  it("the caller's own abort still works", async () => {
    vi.stubGlobal("fetch", hanging());
    const ctrl = new AbortController();
    const p = fetchWithTimeout(60_000)("https://x.test", { signal: ctrl.signal }).catch((e: unknown) => e);
    ctrl.abort(new DOMException("stop", "AbortError"));
    expect(await p).toMatchObject({ name: "AbortError" });
  });
});

describe("the browser client has no hidden retries (QC 2026-11-03: 'Couldn't load' took 14 s)", () => {
  it("supabase-js's built-in GET retries (1 s + 2 s + 4 s) are off; the app's own policy applies", async () => {
    vi.resetModules();
    const created: unknown[] = [];
    vi.doMock("@supabase/ssr", () => ({
      createBrowserClient: (...args: unknown[]) => {
        created.push(args[2]);
        return {};
      },
    }));
    const { getSupabase } = await import("@/lib/supabase/client");
    getSupabase();
    expect(created[0]).toMatchObject({ db: { retry: false } });
    vi.doUnmock("@supabase/ssr");
  });
});
