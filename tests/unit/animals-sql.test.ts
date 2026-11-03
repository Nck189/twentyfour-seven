import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ANIMAL_IDS, ANIMALS, EXERCISE_RULES as R, HATCH_RATES } from "@/content/animals";
import { RARITIES } from "@/content/crops";

/** The M8 SQL mirrors content/animals.ts (the server feeds, hatches and pays produce). */
const sql = readFileSync("supabase/migrations/20261103090000_m8_exercise_animals.sql", "utf8");

describe("animals SQL mirrors the content", () => {
  it("hatch rates as cumulative edges, legendary first", () => {
    const order = [...RARITIES].reverse();
    let edge = "";
    for (const r of order.slice(0, -1)) {
      edge = edge ? `${edge} + ${HATCH_RATES[r]}` : `${HATCH_RATES[r]}`;
      expect(sql).toContain(`when r < ${edge} then '${r}'`);
    }
  });
  it("species pools per rarity, in catalog order", () => {
    for (const r of RARITIES) {
      const ids = ANIMAL_IDS.filter((id) => ANIMALS[id].rarity === r)
        .map((id) => `'${id}'`)
        .join(", ");
      expect(sql).toMatch(new RegExp(`(when '${r}' then|else) array\\[${ids}\\]`));
    }
  });
  it("produce per species", () => {
    for (const id of ANIMAL_IDS) expect(sql).toContain(`when '${id}' then '${ANIMALS[id].produce}'`);
  });
  it("exercise rules", () => {
    expect(sql).toContain(`p_minutes >= ${R.minMinutes} and`);
    expect(sql).toContain(`) < ${R.maxCountedPerDay};`);
    expect(sql).toContain(`gs.egg_progress + 1 >= ${R.workoutsPerEgg}`);
    expect(sql).toContain(`public._add_feed(fed_until, ${R.feedDaysPerWorkout})`);
    expect(sql).toContain(`now() + interval '${R.maxFeedDays} days'`);
    expect(sql).toContain(`interval '${R.produceEveryHours} hours'`);
    expect(sql).toContain(`if today >= ${R.petsPerDay} then`);
    expect(sql).toContain(`least(${R.maxLove}, love + 1)`);
    expect(sql).toContain(`public._add_feed(fed_until, ${R.feedItemDays})`);
  });
});
