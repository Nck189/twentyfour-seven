import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TIP_IDS } from "@/content/tips";

/** Existing accounts get every tip marked seen by the M10 migration: the list must match content. */
describe("tips migration mirrors content/tips.ts", () => {
  it("marks exactly the TIP_IDS as seen", () => {
    const sql = readFileSync("supabase/migrations/20261110000000_m10_weekly_review.sql", "utf8");
    const m = sql.match(/set tips_seen = array\[([^\]]*)\]/);
    expect(m).not.toBeNull();
    expect(m![1]!.split(",").map((x) => x.trim().replace(/'/g, ""))).toEqual([...TIP_IDS]);
  });
});
