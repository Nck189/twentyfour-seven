/** Every user table included in "Export all data" (SPEC §10 v1). */
export const EXPORT_TABLES = [
  "profiles",
  "settings",
  "templates",
  "day_plans",
  "block_logs",
  "backlog_items",
  "exercise_logs",
  "wake_events",
  "game_state",
  "plots",
  "inventory",
  "seed_dex",
  "animals",
  "decor",
  "gacha_pulls",
  "events",
] as const;
export type ExportTable = (typeof EXPORT_TABLES)[number];

export type ExportBundle = {
  app: "24/7";
  version: 1;
  exported_at: string;
  tables: Record<ExportTable, Record<string, unknown>[]>;
};
