import { describe, expect, it } from "vitest";
import { BLOCK_KEYS, type BlockKey } from "@/content/blocks";
import type { DayFacts, GameLog } from "@/lib/game";
import { settleStreak } from "@/lib/game/streak";
import { addDays, zonedInstant } from "@/lib/time";
import { admin, newUser } from "./helpers";

const TZ = "Asia/Bangkok";

/** M9 streak (SPEC §8.7): the server's settle_days = lib/game settleStreak, and pays the tickets once. */
describe("settle_days", () => {
  it("matches the TS rules over two weeks of misses, vacation, a late night and a perfect day", async () => {
    const u = await newUser("streak");
    const a = admin();
    // Find the server's wake-day first (before today's wake it's yesterday).
    const probe = await u.client.rpc("settle_days");
    expect(probe.error).toBeNull();
    const today: string = probe.data.today;
    const start = addDays(today, -15);
    // Pretend the account is older and clear what the probe settled.
    await a
      .from("profiles")
      .update({ created_at: zonedInstant(start, 6 * 60, TZ).toISOString() })
      .eq("user_id", u.id);
    await a.from("day_results").delete().eq("user_id", u.id);
    await a.from("game_state").update({ streak: 0, best_streak: 0, freezes: 0 }).eq("user_id", u.id);

    // Day i (0..14): pattern of facts.
    type P = { wake: boolean; night: boolean; mode?: "vacation" | "sick"; late?: boolean; perfect?: boolean };
    const pattern: P[] = [
      ...Array.from({ length: 7 }, () => ({ wake: true, night: true })), // 0–6 → 7, scarecrow, +5
      { wake: false, night: true }, // 7 frozen
      { wake: false, night: false, mode: "vacation" }, // 8 paused
      { wake: true, night: false, late: true }, // 9 minimum via a planned late night
      { wake: true, night: true, perfect: true }, // 10 perfect → +1
      { wake: true, night: false }, // 11 missed → 0
      { wake: true, night: true }, // 12
      { wake: false, night: false, mode: "sick" }, // 13 paused
      { wake: true, night: true }, // 14
    ];
    const at = (d: string, min: number) => zonedInstant(d, min, TZ).toISOString();
    const facts: DayFacts[] = [];
    for (let i = 0; i < pattern.length; i++) {
      const p = pattern[i]!;
      const d = addDays(start, i);
      if (p.wake)
        await a.from("wake_events").insert({
          user_id: u.id,
          date: d,
          target_wake: at(d, 600),
          pressed_at: at(d, 602),
          in_window: true,
          backfilled: false,
        });
      if (p.night)
        await a.from("ticket_grants").insert({ user_id: u.id, reason: "night", ref_date: d, amount: 1 });
      if (p.mode) await a.from("day_plans").insert({ user_id: u.id, date: d, mode: p.mode });
      if (p.late)
        await a
          .from("day_plans")
          .upsert(
            { user_id: u.id, date: addDays(d, 1), late_night: { return_at: at(addDays(d, 1), 60) } },
            { onConflict: "user_id,date" },
          );
      const logs: Partial<Record<BlockKey, GameLog>> = {};
      if (p.perfect)
        for (const b of BLOCK_KEYS) {
          const log = {
            planned_start: at(d, 600),
            started_at: at(d, 603),
            first10_at: at(d, 610),
            items_done: [],
            items_planned: 0,
            location: "home" as const,
            backfilled: false,
            planned_deviation: false,
            miss_reason: null,
          };
          logs[b] = log;
          await a.from("block_logs").insert({ user_id: u.id, date: d, block: b, ...log });
        }
      facts.push({
        date: d,
        mode: p.mode ?? "normal",
        logs,
        wakeInWindow: p.wake,
        nightRitualDone: p.night,
        exercised: false,
        ...(p.late ? { excused: ["free" as BlockKey] } : {}),
      });
    }
    // Days 15.. up to yesterday: nothing (missed or frozen) — let the TS rules settle them too.
    for (let d = addDays(start, pattern.length); d < today; d = addDays(d, 1))
      facts.push({
        date: d,
        mode: "normal",
        logs: {},
        wakeInWindow: false,
        nightRitualDone: false,
        exercised: false,
      });

    const r = await u.client.rpc("settle_days");
    expect(r.error).toBeNull();
    const ts = settleStreak(facts);
    const { data: rows } = await u.client.from("day_results").select("date, kind").order("date");
    expect(rows!.map((x) => x.kind)).toEqual(ts.days.map((x) => x.kind));
    expect({ streak: r.data.streak, best: r.data.best, freezes: r.data.freezes }).toEqual(ts.state);
    const grants = (
      await a
        .from("ticket_grants")
        .select("reason, ref_date, amount")
        .eq("user_id", u.id)
        .neq("reason", "night")
    ).data!;
    expect(grants.map((g) => `${g.reason}@${g.ref_date}`).sort()).toEqual(
      ts.grants.map((g) => `${g.reason}@${g.date}`).sort(),
    );

    // Settling again changes nothing and pays nothing.
    const again = await u.client.rpc("settle_days");
    expect(again.data.settled).toEqual([]);
    expect(again.data.granted).toEqual([]);
  });

  it("can't be faked: no client writes to day_results, game_state.streak or past excuses", async () => {
    const u = await newUser("streak-fake");
    const { data } = await u.client.rpc("settle_days");
    const today: string = data.today;
    expect(
      (await u.client.from("day_results").insert({ user_id: u.id, date: today, kind: "perfect" })).error,
    ).not.toBeNull();
    await u.client.from("game_state").update({ streak: 99 }).eq("user_id", u.id);
    expect(
      (await admin().from("game_state").select("streak").eq("user_id", u.id).single()).data!.streak,
    ).toBe(0);
    const past = addDays(today, -2);
    expect(
      (await u.client.from("day_plans").insert({ user_id: u.id, date: past, mode: "vacation" })).error,
    ).not.toBeNull();
    expect(
      (
        await u.client
          .from("block_logs")
          .insert({ user_id: u.id, date: addDays(today, -1), block: "free", planned_deviation: true })
      ).error,
    ).not.toBeNull();
    expect(
      (
        await u.client.from("day_plans").insert({
          user_id: u.id,
          date: past,
          late_night: { return_at: zonedInstant(past, 60, TZ).toISOString() },
        })
      ).error,
    ).not.toBeNull();
    expect(
      (await u.client.from("events").insert({ user_id: u.id, type: "days_settled", payload: {} })).error,
    ).not.toBeNull();
  });
});
