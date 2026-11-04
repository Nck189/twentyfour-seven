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
  "ticket_grants",
  "coin_grants",
  "unlock_grants",
  "wake_snapshots",
  "day_results",
] as const;
export type ExportTable = (typeof EXPORT_TABLES)[number];

export type ExportBundle = {
  app: "24/7";
  version: 1;
  exported_at: string;
  tables: Record<ExportTable, Record<string, unknown>[]>;
};

/** Unique ordering per table so paged export reads are stable. */
export const EXPORT_ORDER: Record<ExportTable, string[]> = {
  profiles: ["user_id"],
  settings: ["user_id"],
  templates: ["id"],
  day_plans: ["id"],
  block_logs: ["id"],
  backlog_items: ["id"],
  exercise_logs: ["id"],
  wake_events: ["id"],
  game_state: ["user_id"],
  plots: ["id"],
  inventory: ["item_id"],
  seed_dex: ["crop_id"],
  animals: ["id"],
  decor: ["id"],
  gacha_pulls: ["id"],
  events: ["id"],
  ticket_grants: ["reason", "ref_date"],
  coin_grants: ["reason", "ref"],
  unlock_grants: ["unlock_id"],
  wake_snapshots: ["date"],
  day_results: ["date"],
};
