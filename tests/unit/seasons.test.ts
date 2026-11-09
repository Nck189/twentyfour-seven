import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FESTIVAL_DECOR } from "@/content/decor";
import { FESTIVAL_MONTH, SEASONS, seasonOf } from "@/content/seasons";

const sql = readFileSync("supabase/migrations/20261104000000_m9_streak.sql", "utf8");

describe("seasons (SPEC §8.8)", () => {
  it("12 seasons; every festival item belongs to exactly one month", () => {
    expect(SEASONS).toHaveLength(12);
    expect(Object.keys(FESTIVAL_MONTH).sort()).toEqual([...FESTIVAL_DECOR].sort());
    expect(seasonOf("2026-11-04").id).toBe("loy_krathong");
    expect(seasonOf("2027-04-13").festival).toBe("water_bowl");
  });
  it("the server sells each festival item only in its month (SQL mirror)", () => {
    for (const [id, m] of Object.entries(FESTIVAL_MONTH)) expect(sql).toContain(`when '${id}' then ${m}`);
  });
});

it("season ids are in calendar order", async () => {
  const { SEASON_IDS } = await import("@/content/seasons");
  expect(SEASONS.map((s) => s.id)).toEqual([...SEASON_IDS]);
});
