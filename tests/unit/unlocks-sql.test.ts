import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SETUP_REWARD, SETUP_STEPS } from "@/content/unlocks";

/** The setup-reward SQL mirrors content/unlocks.ts (the server pays). */
// The latest migration that (re)defines a function is the live one for it.
const dir = "supabase/migrations";
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(`${dir}/${f}`, "utf8"));
const latest = (fn: string) => files.filter((t) => t.includes(`function public.${fn}`)).at(-1)!;
const sql = latest("_setup_reward");
const doneSql = latest("_setup_done");

describe("setup rewards SQL mirrors the content", () => {
  it("every step pays exactly the content reward", () => {
    for (const id of SETUP_STEPS) {
      expect(sql).toContain(
        `when '${id}' then '${JSON.stringify(SETUP_REWARD[id]).replace(/,/g, ", ").replace(/:/g, ": ")}'::jsonb`,
      );
    }
  });
  it("every derived step has a data check (home_screen is reported by the device)", () => {
    const start = doneSql.indexOf("function public._setup_done");
    const done = doneSql.slice(start, doneSql.indexOf("$$;", doneSql.indexOf("as $$", start)));
    for (const id of SETUP_STEPS.filter((s) => s !== "home_screen"))
      expect(done).toContain(`then '${id}' end`);
    expect(done).not.toContain("'home_screen'");
  });
});
