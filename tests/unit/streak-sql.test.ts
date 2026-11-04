import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ON_TIME_MIN, PERFECT_DAY_OEE, STREAK_RULES as R } from "@/content/game";

/** settle_days / _day_oee mirror content/game.ts (the server grants the streak tickets). */
const sql = readFileSync("supabase/migrations/20261104000000_m9_streak.sql", "utf8");

describe("streak SQL mirrors the content", () => {
  it("scarecrows, milestones and the Perfect day", () => {
    expect(sql).toContain(`v_streak % ${R.freezeEvery} = 0`);
    expect(sql).toContain(`least(${R.maxFreezes}, v_freezes + 1)`);
    const ms = Object.keys(R.milestones).join(", ");
    expect(sql).toContain(`v_streak in (${ms})`);
    for (const amount of new Set(Object.values(R.milestones))) expect(sql).toContain(`d, ${amount})`);
    expect(sql).toContain(`'perfect_day', d, ${R.perfectDayTickets})`);
    expect(sql).toContain(`o >= ${PERFECT_DAY_OEE}`);
  });
  it("Day OEE uses the same on-time tolerance", () => {
    expect(sql).toContain(`<= ${ON_TIME_MIN * 60} then`);
  });
});
