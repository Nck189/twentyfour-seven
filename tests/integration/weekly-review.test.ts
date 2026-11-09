import { describe, expect, it } from "vitest";
import { admin, newUser } from "./helpers";

/** M10 weekly review (SPEC §7): Keep / Problem / Try on Sunday night, +3 tickets once a week. */
describe("submit_weekly_review", () => {
  it("is open only on the week's Sunday and the Monday after; pays +3 once; can't be faked", async () => {
    const u = await newUser("weekly");
    // An account from 10 days ago: a new one isn't asked to review a week it wasn't around for.
    expect(
      (
        await admin()
          .from("profiles")
          .update({ created_at: new Date(Date.now() - 10 * 86_400_000).toISOString() })
          .eq("user_id", u.id)
      ).error,
    ).toBeNull();
    const status = (await u.client.rpc("weekly_review_status")).data as {
      week_start: string | null;
      done: boolean;
    };
    expect(status.done).toBe(false);
    const kpt = { p_keep: "Woke on time", p_problem: "Phone at night", p_try: "Bed by 23:30" };

    if (status.week_start === null) {
      // Tuesday–Saturday (by wake-day): closed.
      expect((await u.client.rpc("submit_weekly_review", kpt)).error).not.toBeNull();
    } else {
      expect(new Date(`${status.week_start}T00:00:00Z`).getUTCDay()).toBe(1); // a Monday
      // All three are needed (whitespace alone doesn't count).
      expect((await u.client.rpc("submit_weekly_review", { ...kpt, p_try: "\n\t " })).error).not.toBeNull();
      expect((await u.client.rpc("submit_weekly_review", { ...kpt, p_problem: "  " })).error).not.toBeNull();
      const first = await u.client.rpc("submit_weekly_review", kpt);
      expect(first.error).toBeNull();
      expect(first.data).toMatchObject({ week_start: status.week_start, granted: true });
      // Editing while it's open pays nothing more.
      const again = await u.client.rpc("submit_weekly_review", { ...kpt, p_keep: "Woke on time!" });
      expect(again.data).toMatchObject({ granted: false });
      const { data: g } = await u.client.from("game_state").select("tickets").single();
      expect(g!.tickets).toBe(3);
      const { data: rows } = await u.client.from("weekly_reviews").select("keep");
      expect(rows).toEqual([{ keep: "Woke on time!" }]);
      expect((await u.client.rpc("weekly_review_status")).data).toMatchObject({ done: true });
    }

    // Clients can't write reviews, the ledger or the server event themselves.
    expect(
      (
        await u.client
          .from("weekly_reviews")
          .insert({ user_id: u.id, week_start: "2026-11-02", keep: "a", problem: "b", try: "c" })
      ).error,
    ).not.toBeNull();
    expect(
      (await u.client.from("events").insert({ user_id: u.id, type: "weekly_review_done", payload: {} }))
        .error,
    ).not.toBeNull();
    const grants = (await admin().from("ticket_grants").select("reason").eq("user_id", u.id)).data!;
    expect(grants.filter((x) => x.reason === "weekly_review").length).toBeLessThanOrEqual(1);
  });
});

describe("weekly review for a brand-new account (R-M10-6)", () => {
  it("is never open for a week the account wasn't around for", async () => {
    const u = await newUser("weekly-new");
    const status = (await u.client.rpc("weekly_review_status")).data as { week_start: string | null };
    expect(status.week_start).toBeNull();
  });
});
