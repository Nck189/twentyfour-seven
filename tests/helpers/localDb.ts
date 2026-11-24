import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";

/**
 * A local Supabase that missed migrations makes screens fail quietly (404/400 from PostgREST), and
 * visual baselines then record error states. That happened on 2026-11-24: `supabase start` reuses
 * an existing local database and doesn't apply new migrations. Tests stop early instead.
 */
export function missingMigrations(files: readonly string[], applied: readonly string[]): string[] {
  const done = new Set(applied.map((v) => v.trim()).filter(Boolean));
  return files
    .map((f) => /^(\d+)_.*\.sql$/.exec(f)?.[1])
    .filter((v): v is string => Boolean(v))
    .filter((v) => !done.has(v))
    .sort();
}

/** Throws when the local database is behind supabase/migrations; warns and goes on when it can't tell. */
export function assertLocalDbCurrent(): void {
  const project = /^project_id\s*=\s*"([^"]+)"/m.exec(readFileSync("supabase/config.toml", "utf8"))?.[1];
  let applied: string[];
  try {
    applied = execFileSync(
      "docker",
      [
        "exec",
        `supabase_db_${project}`,
        "psql",
        "-U",
        "postgres",
        "-tAc",
        "select version from supabase_migrations.schema_migrations",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 15_000 },
    ).split("\n");
  } catch {
    console.warn("[tests] Couldn't read the local migrations (is Docker up?); not checking them.");
    return;
  }
  const missing = missingMigrations(readdirSync("supabase/migrations"), applied);
  if (missing.length > 0)
    throw new Error(
      `The local database is missing ${missing.length} migration(s): ${missing.join(", ")}.\n` +
        "Run `npx supabase migration up` (local only, keeps your data), then run the tests again.",
    );
}
