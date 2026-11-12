import { readdirSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { EXPORT_ORDER, EXPORT_TABLES } from "@/lib/export/tables";

/** Every per-user table is exported and covered by the RLS loops (R-M7-6). */
it("EXPORT_TABLES lists every table created in the migrations", () => {
  const dir = "supabase/migrations";
  const created = new Set<string>();
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")))
    for (const m of readFileSync(`${dir}/${f}`, "utf8").matchAll(/create table (?:if not exists )?public\.([a-z_]+)/g))
      created.add(m[1]!);
  expect([...created].sort()).toEqual([...EXPORT_TABLES].sort());
  for (const t of EXPORT_TABLES) expect(EXPORT_ORDER[t].length).toBeGreaterThan(0);
});
