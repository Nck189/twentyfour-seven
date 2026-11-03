import { describe, expect, it } from "vitest";
import { ANIMALS } from "@/content/animals";
import { hatchRoll } from "@/lib/game/animals";
import { admin, newUser } from "./helpers";

const key = () => `ex-${Math.random().toString(36).slice(2, 12)}`;

/** M8 exercise + animals (SPEC §6, §8.6): all server-side, mirrors lib/game. */
describe("_hatch_roll (SQL) = lib/game hatchRoll", () => {
  it("same rarity and species for 300 random inputs", async () => {
    for (let i = 0; i < 300; i++) {
      const r = Math.random();
      const c = Math.random();
      const { data, error } = await admin().rpc("_hatch_roll", { r, c });
      expect(error).toBeNull();
      expect(data).toEqual(hatchRoll(r, c));
    }
  });
});

describe("log_exercise", () => {
  it("counts ≥ 10 min up to 2 a day, feeds 2 days, hatches on the 3rd counted workout, once per key", async () => {
    const u = await newUser("ex");
    const a = await u.client.rpc("log_exercise", { p_type: "gym", p_minutes: 30, p_key: "ex-key-aaaa" });
    expect(a.error).toBeNull();
    expect(a.data).toMatchObject({ counted: true, egg_progress: 1, hatched: null, repeat: false });
    const again = await u.client.rpc("log_exercise", { p_type: "gym", p_minutes: 30, p_key: "ex-key-aaaa" });
    expect(again.data).toMatchObject({ repeat: true, id: a.data.id, egg_progress: 1 });
    expect(
      (await u.client.rpc("log_exercise", { p_type: "walk", p_minutes: 5, p_key: key() })).data.counted,
    ).toBe(false);
    expect(
      (await u.client.rpc("log_exercise", { p_type: "run", p_minutes: 20, p_key: key() })).data.counted,
    ).toBe(true);
    // A 3rd counted workout the same day doesn't count (no egg farming).
    const capped = await u.client.rpc("log_exercise", { p_type: "run", p_minutes: 20, p_key: key() });
    expect(capped.data).toMatchObject({ counted: false, egg_progress: 2 });

    // Two counted workouts moved 25 h back → the next one counts and hatches.
    await admin()
      .from("exercise_logs")
      .update({ at: new Date(Date.now() - 25 * 3_600_000).toISOString() })
      .eq("user_id", u.id)
      .eq("counted", true);
    const h = await u.client.rpc("log_exercise", { p_type: "gym", p_minutes: 45, p_key: key() });
    expect(h.data.egg_progress).toBe(0);
    expect(h.data.hatched.species in ANIMALS).toBe(true);
    const { data: animals } = await u.client.from("animals").select("species, fed_until, love");
    expect(animals).toHaveLength(1);
    expect(animals![0]!.species).toBe(h.data.hatched.species);
    const fedMs = Date.parse(animals![0]!.fed_until as string) - Date.now();
    expect(fedMs).toBeGreaterThan(47 * 3_600_000);

    // The next counted workout feeds it 2 more days.
    await admin()
      .from("exercise_logs")
      .update({ at: new Date(Date.now() - 49 * 3_600_000).toISOString() })
      .eq("user_id", u.id)
      .eq("counted", true);
    await u.client.rpc("log_exercise", { p_type: "walk", p_minutes: 30, p_key: key() });
    const { data: fed } = await u.client.from("animals").select("fed_until").single();
    expect(Date.parse(fed!.fed_until as string) - Date.now()).toBeGreaterThan(95 * 3_600_000);
  });

  it("changing the timezone can't reset the 2-a-day or 3-pets caps (R-M8-1)", async () => {
    const u = await newUser("extz");
    expect(
      (await u.client.rpc("log_exercise", { p_type: "gym", p_minutes: 30, p_key: key() })).data.counted,
    ).toBe(true);
    expect(
      (await u.client.rpc("log_exercise", { p_type: "run", p_minutes: 30, p_key: key() })).data.counted,
    ).toBe(true);
    // A fake offset zone is refused; a real far-away zone is allowed but doesn't move the window.
    const fake = await u.client.from("profiles").update({ timezone: "XXX-04:12:07" }).eq("user_id", u.id);
    expect(fake.error).not.toBeNull();
    for (const tz of ["Pacific/Kiritimati", "Etc/GMT+12", "Asia/Bangkok"]) {
      await u.client.from("profiles").update({ timezone: tz }).eq("user_id", u.id);
      expect(
        (await u.client.rpc("log_exercise", { p_type: "walk", p_minutes: 30, p_key: key() })).data.counted,
      ).toBe(false);
    }
    const { data: born } = await admin()
      .from("animals")
      .insert({ user_id: u.id, species: "cat", fed_until: new Date(Date.now() + 86_400_000).toISOString() })
      .select("id")
      .single();
    for (let i = 0; i < 3; i++) await u.client.rpc("pet_animal", { p_id: born!.id });
    await u.client.from("profiles").update({ timezone: "Pacific/Kiritimati" }).eq("user_id", u.id);
    expect((await u.client.rpc("pet_animal", { p_id: born!.id })).data).toMatchObject({
      counted: false,
      love: 3,
    });
  });

  it("refuses bad input and direct writes", async () => {
    const u = await newUser("exbad");
    expect(
      (await u.client.rpc("log_exercise", { p_type: "swim", p_minutes: 30, p_key: key() })).error?.code,
    ).toBe("22023");
    expect(
      (await u.client.rpc("log_exercise", { p_type: "gym", p_minutes: 0, p_key: key() })).error?.code,
    ).toBe("22023");
    expect(
      (await u.client.rpc("log_exercise", { p_type: "gym", p_minutes: 30, p_key: "short" })).error?.code,
    ).toBe("22023");
    expect(
      (await u.client.from("exercise_logs").insert({ user_id: u.id, type: "gym", minutes: 30 })).error,
    ).not.toBeNull();
    expect(
      (await u.client.from("events").insert({ user_id: u.id, type: "egg_hatched", payload: {} })).error,
    ).not.toBeNull();
    expect(
      (await u.client.from("animals").insert({ user_id: u.id, species: "red_panda" })).error,
    ).not.toBeNull();
    expect((await u.client.rpc("_hatch_roll", { r: 0, c: 0 })).error).not.toBeNull();
  });
});

describe("pet / produce / feed", () => {
  it("pets count 3 a day, produce once a day when fed, feed items add a day, all on your own animals only", async () => {
    const u = await newUser("pet");
    const other = await newUser("pet-other");
    const { data: born } = await admin()
      .from("animals")
      .insert({
        user_id: u.id,
        species: "cow",
        fed_until: new Date(Date.now() + 86_400_000).toISOString(),
        created_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      })
      .select("id")
      .single();
    const id = born!.id as string;
    const pets = [];
    for (let i = 0; i < 4; i++) pets.push((await u.client.rpc("pet_animal", { p_id: id })).data);
    expect(pets.map((p) => p.counted)).toEqual([true, true, true, false]);
    expect(pets[3].love).toBe(3);

    const c = await u.client.rpc("collect_produce", { p_id: id });
    expect(c.data).toEqual({ produce: "milk", love: 4 });
    expect((await u.client.rpc("collect_produce", { p_id: id })).error?.code).toBe("P0001");
    const { data: inv } = await u.client
      .from("inventory")
      .select("qty")
      .eq("item_id", "produce:milk")
      .single();
    expect(inv!.qty).toBe(1);

    expect((await u.client.rpc("use_feed", { p_id: id })).error?.code).toBe("P0001");
    await admin().from("inventory").insert({ user_id: u.id, item_id: "feed", qty: 1 });
    expect((await u.client.rpc("use_feed", { p_id: id })).data.feed_left).toBe(0);

    expect((await other.client.rpc("pet_animal", { p_id: id })).error?.code).toBe("P0002");
    expect((await other.client.rpc("collect_produce", { p_id: id })).error?.code).toBe("P0002");
    // A hungry animal makes nothing (and never dies).
    await admin()
      .from("animals")
      .update({ fed_until: new Date(Date.now() - 1000).toISOString(), last_produced: null })
      .eq("id", id);
    expect((await u.client.rpc("collect_produce", { p_id: id })).error?.code).toBe("P0001");
    expect((await u.client.from("animals").select("id")).data).toHaveLength(1);
  });

  it("setting the exercise goal pays the animal-feed setup reward once", async () => {
    const u = await newUser("exsetup");
    await u.client.from("settings").update({ weekly_exercise_goal: 4 }).eq("user_id", u.id);
    expect((await u.client.rpc("claim_setup_rewards")).data.granted).toContain("exercise");
    expect((await u.client.rpc("claim_setup_rewards")).data.granted).toEqual([]);
    const { data } = await u.client.from("inventory").select("qty").eq("item_id", "feed").single();
    expect(data!.qty).toBe(3);
  });
});
