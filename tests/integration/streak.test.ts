import { describe, expect, it } from "vitest";
import { BLOCK_KEYS, type BlockKey } from "@/content/blocks";
import type { DayFacts, GameLog } from "@/lib/game";
import { settleStreak } from "@/lib/game/streak";
import { addDays, localDate, zonedInstant } from "@/lib/time";
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
      { wake: true, night: false, late: true }, // 9 paused: a planned late night (R-M9-2)
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
      // Every seed must land (an ignored error once hid a refused seed, R-M9-12).
      const ok = ({ error }: { error: unknown }) => expect(error).toBeNull();
      if (p.wake)
        ok(
          await a.from("wake_events").insert({
            user_id: u.id,
            date: d,
            target_wake: at(d, 600),
            pressed_at: at(d, 602),
            in_window: true,
            backfilled: false,
          }),
        );
      if (p.night)
        ok(await a.from("ticket_grants").insert({ user_id: u.id, reason: "night", ref_date: d, amount: 1 }));
      if (p.mode) ok(await a.from("day_plans").insert({ user_id: u.id, date: d, mode: p.mode }));
      if (p.late)
        ok(
          await a.from("day_plans").upsert(
            {
              user_id: u.id,
              date: addDays(d, 1),
              late_night: { return_at: at(addDays(d, 1), 60) },
              // Saved that evening, before the night (R-M9-1).
              late_night_set_at: at(d, 18 * 60),
            },
            { onConflict: "user_id,date" },
          ),
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
          ok(await a.from("block_logs").insert({ user_id: u.id, date: d, block: b, ...log }));
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

  it("a late night saved after that night doesn't excuse it (R-M9-1)", async () => {
    const u = await newUser("streak-late");
    const a = admin();
    const today: string = (await u.client.rpc("settle_days")).data.today;
    const y = addDays(today, -1);
    await a
      .from("profiles")
      .update({ created_at: zonedInstant(addDays(today, -3), 6 * 60, TZ).toISOString() })
      .eq("user_id", u.id);
    await a.from("day_results").delete().eq("user_id", u.id);
    const target = zonedInstant(y, 7 * 60, TZ).toISOString();
    expect(
      (
        await a.from("wake_events").insert({
          user_id: u.id,
          date: y,
          target_wake: target,
          pressed_at: target,
          in_window: true,
          backfilled: false,
        })
      ).error,
    ).toBeNull();
    // The morning after: no return time, a return time of "now" or of last night (inside the
    // night's window, so it's the "night is over" rule that refuses it), or a forged stamp.
    for (const late_night of [
      {},
      { return_at: new Date().toISOString() },
      { return_at: zonedInstant(today, 2 * 60, TZ).toISOString() },
    ])
      expect(
        (await u.client.rpc("patch_day_plan", { p_date: today, p_set: { late_night } })).error,
      ).not.toBeNull();
    expect(
      (
        await u.client.from("day_plans").upsert(
          {
            user_id: u.id,
            date: today,
            late_night: { return_at: new Date().toISOString() },
            late_night_set_at: zonedInstant(y, 18 * 60, TZ).toISOString(),
          },
          { onConflict: "user_id,date" },
        )
      ).error,
    ).not.toBeNull();
    const r = await u.client.rpc("settle_days");
    expect(r.error).toBeNull();
    const { data } = await u.client.from("day_results").select("kind").eq("date", y).single();
    expect(data!.kind).toBe("missed");
  });

  it("a timezone change can't reopen a finished day (R-M9-3)", async () => {
    const u = await newUser("streak-tz");
    const today: string = (await u.client.rpc("settle_days")).data.today;
    for (const timezone of ["Pacific/Pago_Pago", "Etc/GMT+12", "Pacific/Honolulu"]) {
      await u.client.from("profiles").update({ timezone }).eq("user_id", u.id);
      // Whatever the clock, the wake-day never moves back…
      const now: string = (await u.client.rpc("settle_days")).data.today;
      expect(now >= today).toBe(true);
      // …so yesterday stays closed to Vacation/Sick.
      expect(
        (await u.client.rpc("patch_day_plan", { p_date: addDays(today, -1), p_set: { mode: "sick" } })).error,
      ).not.toBeNull();
    }
  });

  it("yesterday's check-ins written the next morning are backfills (R-M9-4)", async () => {
    const u = await newUser("streak-bf");
    const today: string = (await u.client.rpc("settle_days")).data.today;
    const y = addDays(today, -1);
    const now = new Date().toISOString();
    const rows = BLOCK_KEYS.map((block) => ({
      user_id: u.id,
      date: y,
      block,
      planned_start: now,
      started_at: now,
      first10_at: now,
    }));
    expect((await u.client.from("block_logs").insert(rows)).error).toBeNull();
    const { data } = await u.client.from("block_logs").select("backfilled").eq("date", y);
    expect(data!.map((r) => r.backfilled)).toEqual(BLOCK_KEYS.map(() => true));
  });
});

describe("a wake-day's own planned starts (Goodnight starts Sleep)", () => {
  it("tonight's Sleep up to 48 h after the wake-day's midnight is live; later isn't", async () => {
    // A day runs wake → next wake: someone up at 19:00 plans Sleep for ~12:00 two days on (+36 h),
    // and the night ritual's Goodnight starts it live. Past 48 h it can't be that day's.
    const u = await newUser("sleep-window");
    const today: string = (await u.client.rpc("settle_days")).data.today;
    const midnight = zonedInstant(today, 0, TZ).getTime();
    const now = new Date().toISOString();
    const row = (block: BlockKey, hours: number) => ({
      user_id: u.id,
      date: today,
      block,
      planned_start: new Date(midnight + hours * 3_600_000).toISOString(),
      started_at: now,
      first10_at: now,
    });
    expect((await u.client.from("block_logs").insert([row("sleep", 40), row("down", 50)])).error).toBeNull();
    const { data } = await u.client.from("block_logs").select("block, backfilled").eq("date", today);
    expect(Object.fromEntries(data!.map((r) => [r.block, r.backfilled]))).toEqual({
      sleep: false,
      down: true,
    });
  });
});

describe("past days stay closed (G7 re-review)", () => {
  it("a day plan or a check-in can't be moved onto another day (R-M9-R1)", async () => {
    const u = await newUser("move-day");
    const today: string = (await u.client.rpc("settle_days")).data.today;
    const later = addDays(today, 10);
    expect(
      (await u.client.rpc("patch_day_plan", { p_date: later, p_set: { mode: "sick" } })).error,
    ).toBeNull();
    expect(
      (
        await u.client
          .from("day_plans")
          .update({ date: addDays(today, -1) })
          .eq("date", later)
      ).error,
    ).not.toBeNull();
    const now = new Date().toISOString();
    expect(
      (
        await u.client
          .from("block_logs")
          .insert({ user_id: u.id, date: today, block: "focus", started_at: now, first10_at: now })
      ).error,
    ).toBeNull();
    expect(
      (
        await u.client
          .from("block_logs")
          .update({ date: addDays(today, -1) })
          .eq("date", today)
      ).error,
    ).not.toBeNull();
    // An upsert that keeps the same keys still works.
    expect(
      (
        await u.client
          .from("block_logs")
          .upsert(
            { user_id: u.id, date: today, block: "focus", items_planned: 2 },
            { onConflict: "user_id,date,block" },
          )
      ).error,
    ).toBeNull();
  });

  it("after I'm up, a later wake time doesn't make today yesterday again (R-M9-R2)", async () => {
    const u = await newUser("wake-push");
    const today = localDate(new Date(), TZ);
    const target = new Date(Date.now() - 3 * 3_600_000).toISOString();
    expect(
      (
        await admin().from("wake_events").insert({
          user_id: u.id,
          date: today,
          target_wake: target,
          pressed_at: target,
          in_window: true,
          backfilled: false,
        })
      ).error,
    ).toBeNull();
    await u.client.from("templates").update({ target_wake: "23:30" }).eq("user_id", u.id);
    expect((await u.client.rpc("settle_days")).data.today).toBe(today);
    expect(
      (await u.client.rpc("patch_day_plan", { p_date: addDays(today, -1), p_set: { mode: "sick" } })).error,
    ).not.toBeNull();
  });

  it("Out late needs a return time on that night (R-M9-R3)", async () => {
    const u = await newUser("late-ret");
    const today: string = (await u.client.rpc("settle_days")).data.today;
    const d = addDays(today, 3);
    const bad = await u.client.rpc("patch_day_plan", {
      p_date: d,
      p_set: { late_night: { return_at: "2099-01-01T00:00:00Z" } },
    });
    expect(bad.error).not.toBeNull();
    const ok = await u.client.rpc("patch_day_plan", {
      p_date: d,
      p_set: { late_night: { return_at: zonedInstant(d, 2 * 60, TZ).toISOString() } },
    });
    expect(ok.error).toBeNull();
  });
});

describe("claim_unlocks", () => {
  it("counts Must tasks as paid, not as relabelled afterwards (R-M9-5)", async () => {
    const u = await newUser("unlock-must");
    const day = new Date(Date.now() - 86_400_000).toISOString();
    const { data: items, error } = await admin()
      .from("backlog_items")
      .insert(
        Array.from({ length: 10 }, (_, i) => ({
          user_id: u.id,
          title: `t${i}`,
          priority: "just_start",
          created_at: day,
          priority_set_at: day,
        })),
      )
      .select("id");
    expect(error).toBeNull();
    for (const { id } of items!) {
      expect((await u.client.rpc("complete_backlog_item", { p_id: id })).error).toBeNull();
    }
    await u.client.from("backlog_items").update({ priority: "must" }).eq("user_id", u.id);
    const r = await u.client.rpc("claim_unlocks");
    expect(r.error).toBeNull();
    expect(r.data.counts.must_done).toBe(0);
    expect(r.data.done).not.toContain("must_10");
  });
});
