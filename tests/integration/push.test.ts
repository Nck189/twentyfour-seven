import { describe, expect, it } from "vitest";
import { admin, anon, newUser } from "./helpers";

/** M11 push notifications (SPEC §9): subscriptions, the uploaded plan, and what's due to send. */
const inMin = (m: number) => new Date(Date.now() + m * 60_000).toISOString();
const item = (ref: string, kind: string, fireAt: string, day: string, block: string | null = null) => ({
  ref,
  kind,
  day,
  block,
  fire_at: fireAt,
  title: "Focus",
  body: "Open the thesis doc",
});
const sub = (n: string) => ({
  p_endpoint: `https://fcm.googleapis.com/fcm/send/${n}`,
  p_p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
  p_auth: "tBHItJI5svbpez7KI4CCXg",
});
const due = async () =>
  (await admin().rpc("push_due", { p_limit: 500 })).data as { user_id: string; ref: string }[];

describe("push notifications (server)", () => {
  it("a device subscribes once per endpoint; it moves to whoever signs in on it", async () => {
    const u = await newUser("push-sub");
    const v = await newUser("push-sub-2");
    const s = sub(`dev-${u.id}`);
    expect((await u.client.rpc("save_push_subscription", s)).error).toBeNull();
    expect((await u.client.rpc("save_push_subscription", s)).error).toBeNull();
    expect((await u.client.from("push_subscriptions").select("endpoint")).data).toHaveLength(1);
    expect((await v.client.rpc("save_push_subscription", s)).error).toBeNull();
    expect((await u.client.from("push_subscriptions").select("endpoint")).data).toEqual([]);
    expect((await v.client.from("push_subscriptions").select("endpoint")).data).toHaveLength(1);
    // Clients can't insert directly, and anon can't subscribe.
    expect(
      (
        await u.client
          .from("push_subscriptions")
          .insert({ user_id: u.id, endpoint: "https://x/y", p256dh: "a", auth: "b" })
      ).error,
    ).not.toBeNull();
    expect((await anon().rpc("save_push_subscription", sub("anon"))).error).not.toBeNull();
    expect(
      (await u.client.rpc("save_push_subscription", { ...sub("x"), p_endpoint: "http://insecure" })).error,
    ).not.toBeNull();
  });

  it("the uploaded plan replaces upcoming reminders; limits are checked; only the server sends", async () => {
    const u = await newUser("push-plan");
    const day = new Date().toISOString().slice(0, 10);
    const plan = [
      item("block_start:x:focus", "block_start", inMin(30), day, "focus"),
      item("night:x", "night", inMin(60), day),
    ];
    expect((await u.client.rpc("set_push_schedule", { p_items: plan })).data).toBe(2);
    expect((await u.client.rpc("set_push_schedule", { p_items: plan.slice(0, 1) })).data).toBe(1);
    expect((await u.client.from("push_schedule").select("ref")).data).toEqual([
      { ref: "block_start:x:focus" },
    ]);
    // Too far ahead, too many, unknown kind: refused. (A past item is dropped, G7 R-M11-3.)
    expect(
      (await u.client.rpc("set_push_schedule", { p_items: [item("a", "night", inMin(60 * 40), day)] })).error
        ?.code,
    ).toBe("22023");
    expect(
      (await u.client.rpc("set_push_schedule", { p_items: [item("a", "night", inMin(-5), day)] })).data,
    ).toBe(0);
    expect(
      (
        await u.client.rpc("set_push_schedule", {
          p_items: Array.from({ length: 25 }, (_, i) => item(`r${i}`, "night", inMin(10 + i), day)),
        })
      ).error?.code,
    ).toBe("22023");
    expect(
      (await u.client.rpc("set_push_schedule", { p_items: [item("a", "spam", inMin(10), day)] })).error,
    ).not.toBeNull();
    // The sender's functions are service-role only.
    expect((await u.client.rpc("push_due", { p_limit: 10 })).error).not.toBeNull();
    expect((await u.client.rpc("push_mark_sent", { p_user: u.id, p_ref: "x" })).error).not.toBeNull();
    expect(
      (
        await u.client
          .from("push_schedule")
          .insert({ user_id: u.id, ref: "z", kind: "night", day, fire_at: inMin(5), title: "t", body: "" })
      ).error,
    ).not.toBeNull();
  });

  it("push_due: due and wanted only; skips a started block, a pressed 'I'm up', a done Night ritual, a turned-off kind", async () => {
    const u = await newUser("push-due");
    await u.client.rpc("save_push_subscription", sub(`due-${u.id}`));
    const day = "2026-11-12";
    // Plan rows directly (they're "due": fire_at a few minutes ago).
    const rows = [
      ["block_start:d:work", "block_start", "work"],
      ["first10:d:focus", "first10", "focus"],
      ["first10:d:work", "first10", "work"],
      ["wake:d", "wake", null],
      ["night:d", "night", null],
      ["night:old", "night", null],
    ].map(([ref, kind, block]) => ({
      user_id: u.id,
      ref,
      kind,
      day,
      block,
      fire_at: ref === "night:old" ? inMin(-30) : inMin(-2),
      title: "t",
      body: "",
    }));
    await admin().from("push_schedule").insert(rows);
    await admin()
      .from("block_logs")
      .insert({ user_id: u.id, date: day, block: "focus", started_at: inMin(-5) });
    await admin()
      .from("wake_events")
      .insert({
        user_id: u.id,
        date: day,
        target_wake: inMin(-60),
        pressed_at: inMin(-50),
        in_window: true,
        backfilled: false,
      });
    const mine = async () =>
      (await due())
        .filter((r) => r.user_id === u.id)
        .map((r) => r.ref)
        .sort();
    expect(await mine()).toEqual(["block_start:d:work", "first10:d:work", "night:d"]);
    await admin()
      .from("events")
      .insert({ user_id: u.id, type: "night_ritual_completed", payload: { date: day } });
    await admin().from("profiles").update({ push_block_start: false }).eq("user_id", u.id);
    expect(await mine()).toEqual(["first10:d:work"]);
    await admin().rpc("push_mark_sent", { p_user: u.id, p_ref: "first10:d:work" });
    expect(await mine()).toEqual([]);
    // A gone device is dropped.
    await admin().rpc("push_drop_endpoint", {
      p_endpoint: `https://fcm.googleapis.com/fcm/send/due-${u.id}`,
    });
    expect((await u.client.from("push_subscriptions").select("id")).data).toEqual([]);
  });

  it("G7 R-M11-1 (S1): only real push-service hosts, at most 10 devices per account", async () => {
    const u = await newUser("push-ssrf");
    for (const endpoint of [
      "https://10.0.0.1:8443/x",
      "https://evil.example.com/fcm/send/x",
      "https://fcm.googleapis.com.evil.com/fcm/send/x",
      "https://localhost/x",
    ])
      expect(
        (await u.client.rpc("save_push_subscription", { ...sub("x"), p_endpoint: endpoint })).error,
      ).not.toBeNull();
    for (const endpoint of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://web.push.apple.com/QGabc",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ])
      expect(
        (await u.client.rpc("save_push_subscription", { ...sub("x"), p_endpoint: endpoint })).error,
      ).toBeNull();
    for (let i = 0; i < 12; i++) await u.client.rpc("save_push_subscription", sub(`cap-${u.id}-${i}`));
    const mine = (await u.client.from("push_subscriptions").select("endpoint")).data as {
      endpoint: string;
    }[];
    expect(mine).toHaveLength(10);
    // The newest devices stay.
    expect(mine.map((m) => m.endpoint)).toContain(`https://fcm.googleapis.com/fcm/send/cap-${u.id}-11`);
  });

  it("G7 R-M11-1 (S1): the sender claims each due reminder once, even with parallel runs", async () => {
    const u = await newUser("push-claim");
    await u.client.rpc("save_push_subscription", sub(`claim-a-${u.id}`));
    await u.client.rpc("save_push_subscription", sub(`claim-b-${u.id}`));
    const day = "2026-11-12";
    await admin()
      .from("push_schedule")
      .insert(
        ["night:c1", "block_start:c:work"].map((ref) => ({
          user_id: u.id,
          ref,
          kind: ref.startsWith("night") ? "night" : "block_start",
          day,
          block: ref.startsWith("night") ? null : "work",
          fire_at: inMin(-1),
          title: "t",
          body: "",
        })),
      );
    const claim = () => admin().rpc("push_claim", { p_limit: 500 });
    const [a, b] = await Promise.all([claim(), claim()]);
    const rows = [...(a.data ?? []), ...(b.data ?? [])].filter(
      (r: { user_id: string }) => r.user_id === u.id,
    );
    // 2 reminders × 2 devices, each exactly once across both runs; marked sent at claim time.
    expect(rows.map((r: { ref: string; endpoint: string }) => `${r.ref} ${r.endpoint}`).sort()).toHaveLength(
      4,
    );
    expect(new Set(rows.map((r: { ref: string; endpoint: string }) => `${r.ref} ${r.endpoint}`)).size).toBe(
      4,
    );
    expect(((await claim()).data ?? []).filter((r: { user_id: string }) => r.user_id === u.id)).toEqual([]);
    const sched = await admin().from("push_schedule").select("sent_at").eq("user_id", u.id);
    expect(sched.data?.every((r) => r.sent_at !== null)).toBe(true);
    expect((await u.client.rpc("push_claim", { p_limit: 10 })).error).not.toBeNull();
  });

  it("G7 R-M11-3: an item that just became due is dropped, not the whole upload", async () => {
    const u = await newUser("push-late");
    const day = new Date().toISOString().slice(0, 10);
    const r = await u.client.rpc("set_push_schedule", {
      p_items: [
        item("night:late", "night", inMin(-1), day),
        item("block_start:ok:work", "block_start", inMin(20), day, "work"),
      ],
    });
    expect(r.error).toBeNull();
    expect((await u.client.from("push_schedule").select("ref")).data).toEqual([
      { ref: "block_start:ok:work" },
    ]);
  });

  it("G7 R-M11-9: a block-start push is skipped once the block was started early", async () => {
    const u = await newUser("push-early");
    await u.client.rpc("save_push_subscription", sub(`early-${u.id}`));
    const day = "2026-11-12";
    await admin()
      .from("push_schedule")
      .insert({
        user_id: u.id,
        ref: "block_start:e:focus",
        kind: "block_start",
        day,
        block: "focus",
        fire_at: inMin(-1),
        title: "t",
        body: "",
      });
    await admin()
      .from("block_logs")
      .insert({ user_id: u.id, date: day, block: "focus", started_at: inMin(-3) });
    expect((await due()).filter((r) => r.user_id === u.id)).toEqual([]);
  });

  it("setup reward: turning on notifications on a device pays the wind chime once (SPEC §8.8c)", async () => {
    const u = await newUser("push-setup");
    expect((await u.client.rpc("claim_setup_rewards")).data.granted).not.toContain("notifications");
    await u.client.rpc("save_push_subscription", sub(`setup-${u.id}`));
    expect((await u.client.rpc("claim_setup_rewards")).data.granted).toContain("notifications");
    expect((await u.client.rpc("claim_setup_rewards")).data.granted).toEqual([]);
    const chime = await admin()
      .from("decor")
      .select("item_id")
      .eq("user_id", u.id)
      .eq("item_id", "wind_chime");
    expect(chime.data).toHaveLength(1);
  });

  it("prefs: switches and quiet hours are the user's own columns, validated", async () => {
    const u = await newUser("push-prefs");
    expect(
      (
        await u.client
          .from("profiles")
          .update({ push_night: false, push_quiet_start: "22:30", push_quiet_end: "07:00" })
          .eq("user_id", u.id)
      ).error,
    ).toBeNull();
    expect(
      (await u.client.from("profiles").update({ push_quiet_start: "25:00" }).eq("user_id", u.id)).error,
    ).not.toBeNull();
  });
});
