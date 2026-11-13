import { beforeEach, describe, expect, it, vi } from "vitest";

/** getUserCached (task #41, G7 PERF P-2/P-3): one verified call per page, never another account's user. */
const state = vi.hoisted(() => ({
  sessionId: "u1" as string | null,
  serverUser: { id: "u1" } as { id: string } | null,
  getUser: 0,
  onChange: null as null | (() => void),
}));
vi.mock("@supabase/ssr", () => ({
  createBrowserClient: () => ({
    auth: {
      getSession: async () => ({
        data: { session: state.sessionId ? { user: { id: state.sessionId } } : null },
      }),
      getUser: async () => {
        state.getUser++;
        return { data: { user: state.serverUser } };
      },
      onAuthStateChange: (cb: () => void) => {
        state.onChange = cb;
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
  }),
}));

import { getUserCached } from "@/lib/supabase/client";

describe("getUserCached", () => {
  beforeEach(() => {
    state.onChange?.();
    state.sessionId = "u1";
    state.serverUser = { id: "u1" };
    state.getUser = 0;
  });

  it("asks the auth server once and shares the answer", async () => {
    const [a, b, c] = await Promise.all([getUserCached(), getUserCached(), getUserCached()]);
    expect([a, b, c].map((r) => r.data.user?.id)).toEqual(["u1", "u1", "u1"]);
    expect(state.getUser).toBe(1);
  });

  it("an auth event starts fresh; signed out returns no user without caching it", async () => {
    await getUserCached();
    state.onChange?.();
    await getUserCached();
    expect(state.getUser).toBe(2);
    state.sessionId = null;
    expect((await getUserCached()).data.user).toBeNull();
    state.sessionId = "u1";
    await getUserCached();
    expect(state.getUser).toBe(3);
  });

  it("G7 PERF P-3: another account in the local session (no event reached this tab) drops the cached user", async () => {
    await getUserCached();
    state.sessionId = "u2";
    state.serverUser = { id: "u2" };
    expect((await getUserCached()).data.user?.id).toBe("u2");
  });

  it("a failed or empty answer is never cached", async () => {
    state.serverUser = null;
    expect((await getUserCached()).data.user).toBeNull();
    state.serverUser = { id: "u1" };
    expect((await getUserCached()).data.user?.id).toBe("u1");
  });
});
