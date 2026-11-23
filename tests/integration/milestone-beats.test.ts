import { describe, expect, it } from "vitest";
import { admin, newUser } from "./helpers";

/**
 * Review fix F5: short scenes at milestones. Each waits for its milestone in the data (the server
 * re-checks), plays once, and pays nothing.
 */
const ageSeen = (id: string) => admin().from("story_seen").update({ day: "2000-01-01" }).eq("user_id", id);

async function refusedThenGranted(beat: string, make: (id: string) => PromiseLike<unknown>) {
  const u = await newUser(`beat-${beat}`);
  const tickets = async () =>
    (
      (await admin().from("game_state").select("tickets").eq("user_id", u.id).single()).data as {
        tickets: number;
      }
    ).tickets;
  expect((await u.client.rpc("claim_story_beat", { p_beat: beat })).error?.code).toBe("P0001");
  await make(u.id);
  const before = await tickets();
  const r = await u.client.rpc("claim_story_beat", { p_beat: beat });
  expect(r.error).toBeNull();
  expect(r.data).toMatchObject({ beat, gift: null });
  expect(await tickets()).toBe(before);
  await ageSeen(u.id);
  expect((await u.client.rpc("claim_story_beat", { p_beat: beat })).error?.code).toBe("P0001");
  return u;
}

describe("milestone scenes (server)", () => {
  it("the first perfect day", async () => {
    const u = await refusedThenGranted("ch7_perfect_day", (id) =>
      admin().from("day_results").insert({ user_id: id, date: "2026-11-01", kind: "perfect" }),
    );
    expect((await u.client.rpc("story_status")).data).toMatchObject({ facts: { perfect_days: 1 } });
  });

  it("a 30-day streak (best ever)", async () => {
    await refusedThenGranted("ch8_thirty_days", (id) =>
      admin().from("game_state").update({ best_streak: 30 }).eq("user_id", id),
    );
  });

  it("the first thing made in the factory", async () => {
    await refusedThenGranted("ch10_first_batch", (id) =>
      admin()
        .from("events")
        .insert({
          user_id: id,
          type: "jobs_collected",
          payload: { machine: "jam", products: { jam: 1 }, n: 1 },
        }),
    );
  });

  it("back after days away (the first welcome back)", async () => {
    await refusedThenGranted("ch11_welcome_back", (id) =>
      admin()
        .from("ticket_grants")
        .insert({ user_id: id, reason: "welcome_back", ref_date: "2026-11-01", amount: 1 }),
    );
  });
});
