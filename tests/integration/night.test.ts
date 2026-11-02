import { describe, expect, it } from "vitest";
import { localDate } from "@/lib/time";
import { addDays } from "@/lib/time";
import { newUser } from "./helpers";

const today = () => localDate(new Date(), "Asia/Bangkok");

describe("complete_night_ritual (CJ-07 ticket)", () => {
  it("grants exactly one Night ticket per day, even when called repeatedly or concurrently", async () => {
    const u = await newUser("night");
    const results = await Promise.all(
      Array.from({ length: 4 }, () => u.client.rpc("complete_night_ritual", { p_date: today() })),
    );
    expect(results.every((r) => r.error === null)).toBe(true);
    expect(results.filter((r) => r.data.ticket_granted)).toHaveLength(1);
    const { data: g } = await u.client.from("game_state").select("tickets").single();
    expect(g!.tickets).toBe(1);
    const { data: grants } = await u.client.from("ticket_grants").select("reason, ref_date, amount");
    expect(grants).toEqual([{ reason: "night", ref_date: today(), amount: 1 }]);
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
});
