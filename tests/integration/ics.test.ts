import { describe, expect, it } from "vitest";
import { anon, newUser } from "./helpers";

/** M11 calendar feed: a secret link per user; anonymous access only with the right token. */
describe(".ics feed (server)", () => {
  it("the link is stable until rotated; only a valid link reads the plan inputs, nothing else", async () => {
    const u = await newUser("ics");
    const a = (await u.client.rpc("ics_link", { p_rotate: false })).data as string;
    expect(a).toMatch(/^[0-9a-f]{48}$/);
    expect((await u.client.rpc("ics_link", { p_rotate: false })).data).toBe(a);
    const ctx = (await anon().rpc("ics_context", { p_token: a })).data as Record<string, unknown>;
    expect(Object.keys(ctx).sort()).toEqual(["day_plans", "locale", "settings", "templates", "timezone"]);
    expect(JSON.stringify(ctx)).not.toContain(u.id);
    // Wrong or malformed tokens read nothing.
    expect((await anon().rpc("ics_context", { p_token: "0".repeat(48) })).data).toBeNull();
    expect((await anon().rpc("ics_context", { p_token: "x' or 1=1 --" })).data).toBeNull();
    // A new link stops the old one.
    const b = (await u.client.rpc("ics_link", { p_rotate: true })).data as string;
    expect(b).not.toBe(a);
    expect((await anon().rpc("ics_context", { p_token: a })).data).toBeNull();
    expect((await anon().rpc("ics_context", { p_token: b })).data).not.toBeNull();
    // Anon can't make links, and the token column isn't writable by the user.
    expect((await anon().rpc("ics_link", { p_rotate: false })).error).not.toBeNull();
    expect(
      (
        await u.client
          .from("profiles")
          .update({ ics_token: "a".repeat(48) })
          .eq("user_id", u.id)
      ).error,
    ).not.toBeNull();
  });
});
