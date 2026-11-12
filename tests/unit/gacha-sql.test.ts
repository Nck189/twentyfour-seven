import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CROPS, GACHA_CROP_IDS } from "@/content/crops";
import { DUPE_SHARDS, PITY, RATES, STAR_UP_COST } from "@/content/gacha";

/** The gacha SQL mirrors content/gacha.ts + content/crops.ts (the server rolls). */
const sql = readFileSync("supabase/migrations/20261103070000_m7_gacha.sql", "utf8");
const roll = sql.slice(
  sql.indexOf("function public._gacha_roll"),
  sql.indexOf("end $$;", sql.indexOf("function public._gacha_roll")),
);

describe("gacha SQL mirrors the content", () => {
  it("rates and pity numbers", () => {
    expect(roll).toContain(`leg := ${RATES.legendary};`);
    expect(roll).toContain(`leg + ${RATES.epic}`);
    expect(roll).toContain(`${RATES.epic} + ${RATES.rare} + ${RATES.uncommon}`);
    expect(roll).toContain(`n >= ${PITY.legendary}`);
    expect(roll).toContain(`n < ${PITY.legendarySoftFrom}`);
    expect(roll).toContain(
      `${RATES.legendary} + ${PITY.legendarySoftStep} * (n - ${PITY.legendarySoftFrom} + 1)`,
    );
    expect(roll).toContain(`se + 1 >= ${PITY.epic}`);
    expect(roll).toContain(`sr + 1 >= ${PITY.rare}`);
  });
  it("crop pools per rarity, in catalog order (seasonal crops are never in the capsule pools)", () => {
    for (const r of ["common", "uncommon", "rare", "epic"] as const) {
      const ids = GACHA_CROP_IDS.filter((id) => CROPS[id].rarity === r)
        .map((id) => `'${id}'`)
        .join(", ");
      expect(roll).toContain(`when '${r}' then array[${ids}]`);
    }
    const leg = GACHA_CROP_IDS.filter((id) => CROPS[id].rarity === "legendary")
      .map((id) => `'${id}'`)
      .join(", ");
    expect(roll).toContain(`else array[${leg}]`);
  });
  it("duplicate shards and star-up costs", () => {
    for (const [r, n] of Object.entries(DUPE_SHARDS)) expect(sql).toContain(`'${r}' then ${n}`);
    for (const [star, cost] of Object.entries(STAR_UP_COST))
      expect(sql).toContain(`when ${star} then ${cost}`);
  });
});
