import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, it } from "vitest";
import { buildExportBundle } from "@/lib/export/buildExport";

/** A fake client: `missing` tables answer like PostgREST for an unknown table; `broken` fails otherwise. */
function fakeClient(missing: string[], broken: string[] = []) {
  return {
    from(table: string) {
      const q = {
        select: () => q,
        order: () => q,
        range: async () =>
          missing.includes(table)
            ? {
                data: null,
                error: { code: "PGRST205", message: `Could not find the table 'public.${table}'` },
              }
            : broken.includes(table)
              ? { data: null, error: { code: "42501", message: "permission denied" } }
              : { data: [], error: null },
      };
      return q;
    },
  } as unknown as SupabaseClient;
}

it("a table that isn't on the server yet exports as empty (code ahead of `db push`)", async () => {
  const bundle = await buildExportBundle(fakeClient(["unlock_grants"]));
  expect(bundle.tables.unlock_grants).toEqual([]);
});

it("any other error still fails the export", async () => {
  await expect(buildExportBundle(fakeClient([], ["profiles"]))).rejects.toMatchObject({ code: "42501" });
});
