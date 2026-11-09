import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { UNLOCK_IDS, UNLOCKS } from "@/content/unlocks";

/** claim_unlocks / _setup_reward mirror content/unlocks.ts UNLOCKS (the server pays). */
const sql = readFileSync("supabase/migrations/20261104000000_m9_streak.sql", "utf8");
const json = (v: unknown) => JSON.stringify(v).replace(/,/g, ", ").replace(/:/g, ": ");

describe("unlock ladder SQL mirrors the content", () => {
  it("every unlock: same metric, goal and reward", () => {
    for (const id of UNLOCK_IDS) {
      const u = UNLOCKS[id];
      expect(sql).toContain(`('${id}', '${u.metric}', ${u.need})`);
      expect(sql).toContain(`when '${id}' then '${json(u.reward)}'::jsonb`);
    }
  });
  it("every metric is counted", () => {
    for (const m of new Set(Object.values(UNLOCKS).map((u) => u.metric)))
      expect(sql).toContain(`'${m}', (select`);
  });
});
