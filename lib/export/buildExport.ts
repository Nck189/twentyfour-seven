import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "@/lib/db/fetchAll";
import { toCsv } from "./csv";
import { EXPORT_ORDER, EXPORT_TABLES, type ExportBundle } from "./tables";
import { createZip } from "./zip";

/** PostgREST / Postgres "no such table": the app can ship before its migration reaches prod. */
const isMissingTable = (e: unknown) => {
  const code = (e as { code?: string } | null)?.code;
  return code === "PGRST205" || code === "42P01";
};

export async function buildExportBundle(client: SupabaseClient, now = new Date()): Promise<ExportBundle> {
  const entries = await Promise.all(
    EXPORT_TABLES.map(async (t) => {
      try {
        return [t, await fetchAll(client, t, EXPORT_ORDER[t])] as const;
      } catch (e) {
        if (isMissingTable(e)) return [t, []] as const;
        throw e;
      }
    }),
  );
  return {
    app: "24/7",
    version: 1,
    exported_at: now.toISOString(),
    tables: Object.fromEntries(entries) as ExportBundle["tables"],
  };
}

export function bundleToJson(bundle: ExportBundle): Blob {
  return new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
}

export function bundleToCsvZip(bundle: ExportBundle): Blob {
  const enc = new TextEncoder();
  const zip = createZip(
    Object.entries(bundle.tables).map(([name, rows]) => ({
      name: `${name}.csv`,
      data: enc.encode(toCsv(rows)),
    })),
  );
  return new Blob([zip as BlobPart], { type: "application/zip" });
}
