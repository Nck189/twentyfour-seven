import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reads every row of a table visible to the current user (RLS), 1000 rows per page,
 * in a stable unique order so pages never skip or repeat rows.
 */
export async function fetchAll(
  client: SupabaseClient,
  table: string,
  orderBy: string[],
): Promise<Record<string, unknown>[]> {
  const pageSize = 1000;
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += pageSize) {
    let q = client.from(table).select("*");
    for (const col of orderBy) q = q.order(col, { ascending: true });
    const { data, error } = await q.range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}
