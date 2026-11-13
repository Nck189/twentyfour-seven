import { describe, expect, it } from "vitest";
import { admin, anon, newUser } from "./helpers";

/** M12 share availability + booking (SPEC §9): a secret link, free/busy only, rate-limited requests. */
const inH = (h: number) => new Date(Date.now() + h * 3_600_000);
const localDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(d);
/** A 30-min slot `h` hours ahead that doesn't cross local midnight. */
function slot(h: number) {
  let start = inH(h);
  start.setUTCSeconds(0, 0);
  let end = new Date(start.getTime() + 30 * 60_000);
  if (localDay(start) !== localDay(new Date(end.getTime() - 1000))) {
    start = new Date(start.getTime() + 60 * 60_000);
    end = new Date(start.getTime() + 30 * 60_000);
  }
  return { p_day: localDay(start), p_start: start.toISOString(), p_end: end.toISOString() };
}

describe("share links + booking (server)", () => {
  it("the link is stable until rotated; the context has no titles, tasks, first-10s or checklists", async () => {
    const u = await newUser("share");
    await admin()
      .from("settings")
      .update({
        blocks: [{ key: "work", duration_min: 480, checklist: ["secret item"], first10: "secret first" }],
      })
      .eq("user_id", u.id);
    await u.client.rpc("patch_day_plan", {
      p_date: localDay(new Date()),
      p_add_events: [{ id: "x", key: "appointment", title: "Secret doctor", start: "10:00", end: "11:00" }],
    });
    const a = (await u.client.rpc("share_link", { p_rotate: false })).data as string;
    expect(a).toMatch(/^[0-9a-f]{48}$/);
    expect((await u.client.rpc("share_link", { p_rotate: false })).data).toBe(a);
    const ctx = (await anon().rpc("share_context", { p_token: a })).data;
    const text = JSON.stringify(ctx);
    for (const secret of ["secret item", "secret first", "Secret doctor", u.id])
      expect(text).not.toContain(secret);
    expect(text).toContain("10:00"); // busy stays busy
    expect((await anon().rpc("share_context", { p_token: "0".repeat(48) })).data).toBeNull();
    const b = (await u.client.rpc("share_link", { p_rotate: true })).data as string;
    expect((await anon().rpc("share_context", { p_token: a })).data).toBeNull();
    expect((await anon().rpc("share_context", { p_token: b })).data).not.toBeNull();
    expect((await anon().rpc("share_link", { p_rotate: false })).error).not.toBeNull();
  });

  it("anyone with the link can ask for a slot; checked and rate-limited; the owner sees only theirs", async () => {
    const u = await newUser("book");
    const tok = (await u.client.rpc("share_link", { p_rotate: false })).data as string;
    const ask = (s: ReturnType<typeof slot>, name = "Ploy", note = "coffee?") =>
      anon().rpc("request_slot", { p_token: tok, ...s, p_name: name, p_note: note });
    expect((await ask(slot(3))).error).toBeNull();
    // Bad link, empty name, too long, in the past, too far, too short: refused.
    expect(
      (await anon().rpc("request_slot", { p_token: "0".repeat(48), ...slot(3), p_name: "x" })).error?.code,
    ).toBe("P0002");
    expect((await ask(slot(4), "  ")).error?.code).toBe("22023");
    expect((await ask(slot(4), "x".repeat(61))).error?.code).toBe("22023");
    expect(
      (await ask({ ...slot(4), p_start: inH(-2).toISOString(), p_end: inH(-1.5).toISOString() })).error?.code,
    ).toBe("22023");
    const far = slot(24 * 20);
    expect((await ask(far)).error?.code).toBe("22023");
    const s = slot(5);
    expect(
      (await ask({ ...s, p_end: new Date(new Date(s.p_start).getTime() + 5 * 60_000).toISOString() })).error
        ?.code,
    ).toBe("22023");
    // 5 an hour: the 6th is refused.
    for (let i = 0; i < 4; i++) expect((await ask(slot(6 + i))).error).toBeNull();
    expect((await ask(slot(11))).error?.code).toBe("P0001");
    const mine = await u.client.from("booking_requests").select("name, status");
    expect(mine.data).toHaveLength(5);
    const other = await newUser("book-other");
    expect((await other.client.from("booking_requests").select("id")).data).toEqual([]);
    expect((await anon().from("booking_requests").select("id")).data ?? []).toEqual([]);
    // Clients can't write requests directly.
    expect(
      (
        await u.client
          .from("booking_requests")
          .insert({ user_id: u.id, day: s.p_day, start_at: s.p_start, end_at: s.p_end, name: "x" })
      ).error,
    ).not.toBeNull();
  });

  it("accepting adds a fixed event to that day's plan; declining doesn't; each answer once, owner only", async () => {
    const u = await newUser("answer");
    const tok = (await u.client.rpc("share_link", { p_rotate: false })).data as string;
    const s1 = slot(3);
    const s2 = slot(4);
    const id1 = (await anon().rpc("request_slot", { p_token: tok, ...s1, p_name: "Ploy", p_note: "" }))
      .data as string;
    const id2 = (await anon().rpc("request_slot", { p_token: tok, ...s2, p_name: "Mew", p_note: "" }))
      .data as string;
    const other = await newUser("answer-other");
    expect((await other.client.rpc("answer_booking", { p_id: id1, p_accept: true })).error?.code).toBe(
      "P0002",
    );
    expect((await u.client.rpc("answer_booking", { p_id: id1, p_accept: true })).error).toBeNull();
    expect((await u.client.rpc("answer_booking", { p_id: id1, p_accept: false })).error?.code).toBe("P0001");
    expect((await u.client.rpc("answer_booking", { p_id: id2, p_accept: false })).error).toBeNull();
    const plan = (
      await admin().from("day_plans").select("overrides").eq("user_id", u.id).eq("date", s1.p_day).single()
    ).data as {
      overrides: {
        fixed_events: { id: string; title: string; key: string; host: string; start: string; end: string }[];
      };
    };
    const ev = plan.overrides.fixed_events.find((e) => e.id === `booking-${id1}`);
    expect(ev).toMatchObject({ key: "appointment", title: "Ploy", host: "free" });
    expect(ev?.start).toMatch(/^\d\d:\d\d$/);
    expect(JSON.stringify(plan.overrides)).not.toContain("Mew");
    const st = (await u.client.from("booking_requests").select("name, status").order("name")).data;
    expect(st).toEqual([
      { name: "Mew", status: "declined" },
      { name: "Ploy", status: "accepted" },
    ]);
    // Server-written events only.
    expect(
      (await u.client.from("events").insert({ user_id: u.id, type: "booking_answered", payload: {} })).error,
    ).not.toBeNull();
  });
});
