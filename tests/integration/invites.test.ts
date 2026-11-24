import { describe, expect, it } from "vitest";
import { admin, newUser } from "./helpers";

/** Invites (docs/FRIENDS-DESIGN.md): the switch, links with room for 2, and the first-day reward. */
const tickets = async (id: string) =>
  ((await admin().from("game_state").select("tickets").eq("user_id", id).single()).data?.tickets ??
    0) as number;

async function setSwitch(on: boolean, since: string | null = null) {
  await admin()
    .from("app_config")
    .upsert({ key: "invite_only", value: { on, since }, updated_at: new Date().toISOString() });
}

async function link(client: Awaited<ReturnType<typeof newUser>>["client"]) {
  const r = await client.rpc("create_invite_link");
  expect(r.error).toBeNull();
  return (r.data as { token: string }).token;
}

/** A settled day for `id`, lived (a live check-in) unless `backfilled`. */
async function settleDay(id: string, date: string, kind: string, backfilled = false) {
  await admin().from("block_logs").insert({ user_id: id, date, block: "wake", backfilled });
  await admin().from("day_results").upsert({ user_id: id, date, kind });
}

describe("invites (server)", () => {
  it("a new friend joins through a link; the link has room for 2; both get 1 ticket on the friend's first lived day", async () => {
    const host = await newUser("inv-host");
    const token = await link(host.client);
    expect((await admin().rpc("invite_preview", { p_token: token })).data).toMatchObject({ open: true });

    const a = await newUser("inv-a");
    const b = await newUser("inv-b");
    const c = await newUser("inv-c");
    expect((await a.client.rpc("claim_invite", { p_token: token })).data).toMatchObject({ already: false });
    expect((await a.client.rpc("claim_invite", { p_token: token })).data).toMatchObject({ already: true });
    expect((await b.client.rpc("claim_invite", { p_token: token })).error).toBeNull();
    // Full: the third is refused, and the preview says so.
    expect((await c.client.rpc("claim_invite", { p_token: token })).error?.message).toBe("invite full");
    expect((await admin().rpc("invite_preview", { p_token: token })).data).toMatchObject({ open: false });

    const [h0, a0] = [await tickets(host.id), await tickets(a.id)];
    // A backfilled-only day doesn't pay; a missed day doesn't pay; a lived minimum day does, once.
    await settleDay(a.id, "2026-11-20", "minimum", true);
    await settleDay(a.id, "2026-11-21", "missed");
    expect([await tickets(host.id), await tickets(a.id)]).toEqual([h0, a0]);
    await settleDay(a.id, "2026-11-22", "minimum");
    expect([await tickets(host.id), await tickets(a.id)]).toEqual([h0 + 1, a0 + 1]);
    await settleDay(a.id, "2026-11-23", "perfect");
    expect([await tickets(host.id), await tickets(a.id)]).toEqual([h0 + 1, a0 + 1]);
    // A second friend finishing on the same date pays the host again (not lost to the ledger key).
    await settleDay(b.id, "2026-11-22", "minimum");
    expect(await tickets(host.id)).toBe(h0 + 2);

    const status = (await host.client.rpc("invite_status")).data as {
      quota: number;
      joined: { paid: boolean }[];
    };
    expect(status.quota).toBe(2);
    expect(status.joined.map((j) => j.paid)).toEqual([true, true]);
  });

  it("refuses your own link, an old account, a turned-off link and a made-up token", async () => {
    const host = await newUser("inv-own");
    const token = await link(host.client);
    expect((await host.client.rpc("claim_invite", { p_token: token })).error?.message).toBe("own invite");
    const old = await newUser("inv-old");
    await admin()
      .from("profiles")
      .update({ created_at: new Date(Date.now() - 5 * 86_400_000).toISOString() })
      .eq("user_id", old.id);
    expect((await old.client.rpc("claim_invite", { p_token: token })).error?.message).toBe(
      "not a new account",
    );
    const fresh = await host.client.rpc("create_invite_link", { p_new: true });
    const late = await newUser("inv-late");
    expect((await late.client.rpc("claim_invite", { p_token: token })).error?.message).toBe("no such invite");
    expect((await late.client.rpc("claim_invite", { p_token: "0".repeat(48) })).error?.message).toBe(
      "no such invite",
    );
    expect(
      (await late.client.rpc("claim_invite", { p_token: (fresh.data as { token: string }).token })).error,
    ).toBeNull();
  });

  it("two friends racing for the last place: only one gets it", async () => {
    const host = await newUser("inv-race");
    const token = await link(host.client);
    await admin().from("invite_links").update({ quota: 1 }).eq("user_id", host.id);
    const [x, y] = await Promise.all([newUser("inv-rx"), newUser("inv-ry")]);
    const r = await Promise.all([x, y].map((u) => u.client.rpc("claim_invite", { p_token: token })));
    expect(r.filter((q) => q.error === null)).toHaveLength(1);
    expect(r.find((q) => q.error)?.error?.message).toBe("invite full");
  });

  it("no limit for an unlimited link (Minnie)", async () => {
    const host = await newUser("inv-unl");
    const token = await link(host.client);
    await admin().from("invite_links").update({ quota: null }).eq("user_id", host.id);
    for (let i = 0; i < 3; i++) {
      const u = await newUser(`inv-unl${i}`);
      expect((await u.client.rpc("claim_invite", { p_token: token })).error).toBeNull();
    }
  });

  it("the switch: off lets everyone in; on lets in invited accounts and accounts made before it", async () => {
    const before = await newUser("inv-before");
    // The inviter has access before the switch goes on (made before it).
    const host = await newUser("inv-sw-host");
    const hostToken = await link(host.client);
    try {
      await setSwitch(false);
      expect((await before.client.rpc("my_access")).data).toMatchObject({
        invite_only: false,
        allowed: true,
      });
      await setSwitch(true, new Date().toISOString());
      const after = await newUser("inv-after");
      expect((await before.client.rpc("my_access")).data).toMatchObject({ invite_only: true, allowed: true });
      expect((await after.client.rpc("my_access")).data).toMatchObject({ invite_only: true, allowed: false });
      await after.client.rpc("claim_invite", { p_token: hostToken });
      expect((await after.client.rpc("my_access")).data).toMatchObject({ allowed: true });
    } finally {
      await setSwitch(false);
    }
  });

  it("users can't write invites, links or the switch themselves", async () => {
    const u = await newUser("inv-write");
    await u.client.from("invites").insert({ user_id: u.id, inviter_id: u.id });
    expect((await admin().from("invites").select("*").eq("user_id", u.id)).data).toEqual([]);
    await u.client.from("invite_links").insert({ user_id: u.id, token: "a".repeat(48), quota: null });
    expect((await admin().from("invite_links").select("*").eq("user_id", u.id)).data).toEqual([]);
    const r = await u.client.from("app_config").select("*");
    expect(r.data ?? []).toEqual([]);
  });

  it("a deleted friend doesn't free their place: the link's room is spent for good (G7 INV F1)", async () => {
    const host = await newUser("inv-del-host");
    const token = await link(host.client);
    const a = await newUser("inv-del-a");
    const b = await newUser("inv-del-b");
    await a.client.rpc("claim_invite", { p_token: token });
    await b.client.rpc("claim_invite", { p_token: token });
    expect((await a.client.rpc("delete_my_account")).error).toBeNull();
    const c = await newUser("inv-del-c");
    expect((await c.client.rpc("claim_invite", { p_token: token })).error?.message).toBe("invite full");
    expect((await admin().rpc("invite_preview", { p_token: token })).data).toMatchObject({ open: false });
  });

  it("with the switch on, a gated account of any age can still join through an invite (G7 INV F2)", async () => {
    const host = await newUser("inv-gated-host");
    const hostToken = await link(host.client);
    try {
      await setSwitch(true, new Date(Date.now() - 86_400_000).toISOString());
      const old = await newUser("inv-gated-old");
      // Made after the switch, but over 3 days ago by the time it finds an invite.
      await admin()
        .from("profiles")
        .update({ created_at: new Date(Date.now() - 3_600_000).toISOString() })
        .eq("user_id", old.id);
      await setSwitch(true, new Date(Date.now() - 5 * 86_400_000).toISOString());
      await admin()
        .from("profiles")
        .update({ created_at: new Date(Date.now() - 4 * 86_400_000).toISOString() })
        .eq("user_id", old.id);
      expect((await old.client.rpc("my_access")).data).toMatchObject({ allowed: false });
      expect((await old.client.rpc("claim_invite", { p_token: hostToken })).error).toBeNull();
      expect((await old.client.rpc("my_access")).data).toMatchObject({ allowed: true });
    } finally {
      await setSwitch(false);
    }
  });

  it("a gated account can't make invite links to let others in (G7 INV F4)", async () => {
    try {
      await setSwitch(true, new Date(Date.now() - 60_000).toISOString());
      const gated = await newUser("inv-gated-link");
      expect((await gated.client.rpc("my_access")).data).toMatchObject({ allowed: false });
      expect((await gated.client.rpc("create_invite_link")).error?.message).toBe("no access");
    } finally {
      await setSwitch(false);
    }
  });
});
