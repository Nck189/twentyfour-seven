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
  const early = (await u.client.rpc("claim_story_beat", { p_beat: beat })).error;
  expect(early?.code).toBe("P0001");
  expect(early?.message).toBe("not yet");
  await make(u.id);
  const before = await tickets();
  const r = await u.client.rpc("claim_story_beat", { p_beat: beat });
  expect(r.error).toBeNull();
  expect(r.data).toMatchObject({ beat, gift: null });
  expect(await tickets()).toBe(before);
  await ageSeen(u.id);
  const again = (await u.client.rpc("claim_story_beat", { p_beat: beat })).error;
  expect(again?.code).toBe("P0001");
  expect(again?.message).toBe("already seen");
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

  it("back after days away: only a welcome back in the last 7 days counts (G7 S3-2)", async () => {
    const day = async (id: string) =>
      ((await admin().rpc("_story_facts", { uid: id })).data as { day: string }).day;
    // An old welcome back (weeks ago) doesn't bring the scene now.
    const old = await newUser("beat-welcome-old");
    const today = await day(old.id);
    const weeksAgo = new Date(Date.parse(today) - 30 * 86_400_000).toISOString().slice(0, 10);
    await admin()
      .from("ticket_grants")
      .insert({ user_id: old.id, reason: "welcome_back", ref_date: weeksAgo, amount: 1 });
    const r = (await old.client.rpc("claim_story_beat", { p_beat: "ch11_welcome_back" })).error;
    expect(r?.message).toBe("not yet");
    // Today's welcome back does.
    await refusedThenGranted("ch11_welcome_back", async (id) =>
      admin()
        .from("ticket_grants")
        .insert({ user_id: id, reason: "welcome_back", ref_date: await day(id), amount: 1 }),
    );
  });
});
