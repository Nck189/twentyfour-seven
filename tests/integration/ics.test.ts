import { describe, expect, it } from "vitest";
import { admin, anon, newUser } from "./helpers";

/** M11 calendar feed: a secret link per user; anonymous access only with the right token. */
describe(".ics feed (server)", () => {
  it("the link is stable until rotated; only a valid link reads the plan inputs, nothing else", async () => {
    const u = await newUser("ics");
    await admin()
      .from("settings")
      .update({ blocks: [{ key: "work", duration_min: 480, checklist: ["secret item"] }] })
      .eq("user_id", u.id);
    const a = (await u.client.rpc("ics_link", { p_rotate: false })).data as string;
    expect(a).toMatch(/^[0-9a-f]{48}$/);
    expect((await u.client.rpc("ics_link", { p_rotate: false })).data).toBe(a);
    const ctx = (await anon().rpc("ics_context", { p_token: a })).data as Record<string, unknown>;
    expect(Object.keys(ctx).sort()).toEqual(["day_plans", "locale", "settings", "templates", "timezone"]);
    expect(JSON.stringify(ctx)).not.toContain(u.id);
    // G7 R-M11-7: checklists never leave through the link.
    expect(JSON.stringify(ctx)).not.toContain("checklist");
    // Wrong or malformed tokens read nothing.
    expect((await anon().rpc("ics_context", { p_token: "0".repeat(48) })).data).toBeNull();
    expect((await anon().rpc("ics_context", { p_token: "x' or 1=1 --" })).data).toBeNull();
    // A new link stops the old one.
    const b = (await u.client.rpc("ics_link", { p_rotate: true })).data as string;
    expect(b).not.toBe(a);
    expect((await anon().rpc("ics_context", { p_token: a })).data).toBeNull();
    expect((await anon().rpc("ics_context", { p_token: b })).data).not.toBeNull();
    // Making and rotating the link are logged (server-written events only).
    const ev = await admin()
      .from("events")
      .select("payload")
      .eq("user_id", u.id)
      .eq("type", "ics_link_made")
      .order("at");
    expect(ev.data).toEqual([{ payload: { rotated: false } }, { payload: { rotated: true } }]);
    expect(
      (await u.client.from("events").insert({ user_id: u.id, type: "ics_link_made", payload: {} })).error,
    ).not.toBeNull();
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
