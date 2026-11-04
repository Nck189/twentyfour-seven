import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CROP_IDS, CROPS, GROW_DAYS, STARTER_CROPS } from "@/content/crops";
import { BLOCK_KEYS } from "@/content/blocks";
import { DEAD_AT_MISSES, ON_TIME_MIN, SUCCESS_CHECKLIST_RATE } from "@/content/game";

/** The farm SQL mirrors content/crops.ts + content/game.ts (the server re-checks ripeness). */
const sql = readFileSync("supabase/migrations/20261103060000_m6_farm.sql", "utf8");
const list = (s: string) => [...s.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

describe("farm SQL mirrors the static content", () => {
  it("starter seeds", () => {
    const m = sql.match(/_starter_crop[\s\S]*?array\[([^\]]+)\]/)!;
    expect(list(m[1]!)).toEqual(STARTER_CROPS);
  });
  it("grow days per crop", () => {
    const body = sql.match(/_crop_grow_days[\s\S]*?end\)::smallint/)![0];
    const fromSql: Record<string, number> = {};
    for (const m of body.matchAll(/when p_crop in \(([^)]+)\) then (\d+)/g))
      for (const id of list(m[1]!)) fromSql[id!] = Number(m[2]);
    expect(fromSql).toEqual(Object.fromEntries(CROP_IDS.map((id) => [id, CROPS[id].growDays])));
    expect(Object.values(GROW_DAYS)).toEqual([1, 2, 3, 5, 7]);
  });
  it("regrowing crops, block plots, success and death numbers", () => {
    const regrow = sql.match(/_crop_regrows[\s\S]*?p_crop in \(([^)]+)\)/)!;
    expect(list(regrow[1]!)).toEqual(CROP_IDS.filter((id) => CROPS[id].regrow));
    const slots = sql.match(/p_slot not in \(([^)]+)\)/)!;
    expect(list(slots[1]!)).toEqual([...BLOCK_KEYS]);
    expect(sql).toContain(`<= ${ON_TIME_MIN * 60}`);
    expect(sql).toContain(`>= ${SUCCESS_CHECKLIST_RATE}`);
    expect(sql).toContain(`streak >= ${DEAD_AT_MISSES}`);
  });
});

describe("decor prices mirror content/decor.ts", () => {
  it("every item, same price", async () => {
    const { SHOP_DECOR, DECOR_PRICE } = await import("@/content/decor");
    // The latest migration that (re)defines the price list is the live one.
    const { readdirSync } = await import("node:fs");
    const dir = "supabase/migrations";
    const latest = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => readFileSync(`${dir}/${f}`, "utf8"))
      .filter((t) => t.includes("function public._decor_price"))
      .at(-1)!;
    const body = latest.match(/function public._decor_price[\s\S]*?end;/)![0];
    const fromSql = Object.fromEntries(
      [...body.matchAll(/when '([a-z_]+)' then (\d+)/g)].map((m) => [m[1], Number(m[2])]),
    );
    expect(fromSql).toEqual(Object.fromEntries(SHOP_DECOR.map((id) => [id, DECOR_PRICE[id]])));
  });
});
