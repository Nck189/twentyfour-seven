import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SETUP_REWARD, SETUP_STEPS } from "@/content/unlocks";

/** The setup-reward SQL mirrors content/unlocks.ts (the server pays). */
// The latest migration that (re)defines the setup functions is the live one.
const dir = "supabase/migrations";
const latest = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .filter((f) => readFileSync(`${dir}/${f}`, "utf8").includes("function public._setup_reward"))
  .at(-1)!;
const sql = readFileSync(`${dir}/${latest}`, "utf8");

describe("setup rewards SQL mirrors the content", () => {
  it("every step pays exactly the content reward", () => {
    for (const id of SETUP_STEPS) {
      expect(sql).toContain(
        `when '${id}' then '${JSON.stringify(SETUP_REWARD[id]).replace(/,/g, ", ").replace(/:/g, ": ")}'::jsonb`,
      );
    }
  });
  it("every derived step has a data check (home_screen is reported by the device)", () => {
    const done = sql.slice(
      sql.indexOf("function public._setup_done"),
      sql.indexOf("function public.claim_setup_rewards"),
    );
    for (const id of SETUP_STEPS.filter((s) => s !== "home_screen"))
      expect(done).toContain(`then '${id}' end`);
    expect(done).not.toContain("'home_screen'");
  });
});
