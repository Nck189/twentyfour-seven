import { describe, expect, it } from "vitest";
import { admin, newUser } from "./helpers";

/** Playtest R1 P2: "I'm up" pressed before the target starts the day (server side, `_wake_day`). */
describe("an early I'm up starts the day", () => {
  it("settle_days' today flips to the pressed date at the press, not at the target", async () => {
    const u = await newUser("early-wake");
    // A zone where it's around midday, so target (now + 40 min) stays on the same local date.
    const off = ((12 - new Date().getUTCHours() + 24 + 12) % 24) - 12; // −12 … +11
    const tz = off === 0 ? "Etc/GMT" : `Etc/GMT${off > 0 ? "-" : "+"}${Math.abs(off)}`;
    expect((await u.client.from("profiles").update({ timezone: tz }).eq("user_id", u.id)).error).toBeNull();
    const local = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
    // Today's target is 40 min from now (the "I'm up" window opens 3 h before).
    await admin().from("wake_snapshots").delete().eq("user_id", u.id);
    const target = new Date(Date.now() + 40 * 60_000).toISOString();
    expect(
      (
        await admin()
          .from("wake_snapshots")
          .insert({ user_id: u.id, date: local, target_wake: target, window_min: 15 })
      ).error,
    ).toBeNull();
    const before: string = (await u.client.rpc("settle_days")).data.today;
    expect(before < local).toBe(true); // still yesterday's day
    const pressed = await u.client.rpc("press_wake");
    expect(pressed.error).toBeNull();
    expect(pressed.data).toMatchObject({ date: local, in_window: true });
    const after: string = (await u.client.rpc("settle_days")).data.today;
    expect(after).toBe(local);
  });
});
