import { describe, expect, it } from "vitest";
import { addDays, localDate, localParts } from "@/lib/time";
import { admin, newUser } from "./helpers";

const TZ = "Asia/Bangkok";
const today = () => localDate(new Date(), TZ);
const H = 3_600_000;

/** Every kind of day wakes at the local time of (now + ms); returns the wake-day whose night that is. */
async function nextWakeIn(u: { id: string }, ms: number) {
  const at = new Date(Date.now() + ms);
  const p = localParts(at, TZ);
  const hhmm = `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
  await admin().from("templates").update({ target_wake: hhmm, options: {} }).eq("user_id", u.id);
  await admin().from("wake_snapshots").delete().eq("user_id", u.id); // as if set long ago
  return addDays(localDate(at, TZ), -1);
}

describe("complete_night_ritual (CJ-07 ticket)", () => {
  it("grants exactly one Night ticket per day, even when called repeatedly or concurrently", async () => {
    const u = await newUser("night");
    const day = await nextWakeIn(u, 8 * H); // before bed: tomorrow's wake is 8 h away
    const results = await Promise.all(
      Array.from({ length: 4 }, () => u.client.rpc("complete_night_ritual", { p_date: day })),
    );
    expect(results.every((r) => r.error === null)).toBe(true);
    expect(results.filter((r) => r.data.ticket_granted)).toHaveLength(1);
    const { data: g } = await u.client.from("game_state").select("tickets").single();
    expect(g!.tickets).toBe(1);
    const { data: grants } = await u.client.from("ticket_grants").select("reason, ref_date, amount");
    expect(grants).toEqual([{ reason: "night", ref_date: day, amount: 1 }]);
  });

  it("yesterday is allowed (ritual after midnight); future and old dates are rejected", async () => {
    const u = await newUser("night-dates");
    expect((await u.client.rpc("complete_night_ritual", { p_date: addDays(today(), -1) })).error).toBeNull();
    expect(
      (await u.client.rpc("complete_night_ritual", { p_date: addDays(today(), 1) })).error,
    ).not.toBeNull();
    expect(
      (await u.client.rpc("complete_night_ritual", { p_date: addDays(today(), -5) })).error,
    ).not.toBeNull();
  });

  it("the grant ledger is read-only for clients", async () => {
    const u = await newUser("night-ledger");
    await nextWakeIn(u, 8 * H);
    const ins = await u.client
      .from("ticket_grants")
      .insert({ user_id: u.id, reason: "night", ref_date: "2026-01-01", amount: 99 });
    expect(ins.error?.code).toBe("42501");
    await u.client.rpc("complete_night_ritual", { p_date: today() });
    const del = await u.client.from("ticket_grants").delete().eq("user_id", u.id).select();
    expect(del.data ?? []).toEqual([]);
    // Re-calling after a (blocked) delete still doesn't grant twice.
    const again = await u.client.rpc("complete_night_ritual", { p_date: today() });
    expect(again.data.ticket_granted).toBe(false);
  });

  it("no ticket the next morning, or at noon for tonight (only before bed)", async () => {
    const morning = await newUser("night-morning");
    const lastNight = await nextWakeIn(morning, -2 * H); // woke 2 h ago
    const r1 = await morning.client.rpc("complete_night_ritual", { p_date: lastNight });
    // Run between 00:00 and 02:00 the wake was "yesterday", so last night is 2 days back and the
    // date itself is refused; either way no ticket.
    if ([today(), addDays(today(), -1)].includes(lastNight))
      expect(r1.data).toMatchObject({ ticket_granted: false, in_time: false });
    else expect(r1.error).not.toBeNull();
    const { data: m } = await morning.client.from("game_state").select("tickets").single();
    expect(m!.tickets).toBe(0);

    const noon = await newUser("night-noon");
    const tonight = await nextWakeIn(noon, 20 * H); // bed is still far away
    if ([today(), addDays(today(), -1)].includes(tonight)) {
      const r2 = await noon.client.rpc("complete_night_ritual", { p_date: tonight });
      expect(r2.data).toMatchObject({ ticket_granted: false, in_time: false });
    }
    const { data: g } = await noon.client.from("game_state").select("tickets").single();
    expect(g!.tickets).toBe(0);
  });
});
