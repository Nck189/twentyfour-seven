import { describe, expect, it } from "vitest";
import { missingMigrations } from "../helpers/localDb";

describe("local DB preflight (visual baselines 2026-11-24)", () => {
  it("lists migration files the local database hasn't applied, oldest first", () => {
    const files = [
      "20261124000000_farm_yard.sql",
      "20261101000000_a.sql",
      "README.md",
      "20261123000000_b.sql",
    ];
    expect(missingMigrations(files, ["20261101000000", "20261123000000", "20261124000000"])).toEqual([]);
    expect(missingMigrations(files, ["20261101000000\n", ""])).toEqual(["20261123000000", "20261124000000"]);
  });
});
