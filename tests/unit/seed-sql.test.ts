import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_BLOCKS } from "@/content/blocks";
import { DEFAULT_SETTINGS, DEFAULT_TEMPLATES } from "@/content/defaults";
import { seedSql } from "@/scripts/gen-seed-sql";

describe("seed defaults", () => {
  it("committed SQL migration matches content/defaults.ts (no drift)", () => {
    const committed = readFileSync("supabase/migrations/20261102020000_seed_defaults.sql", "utf8");
    expect(committed).toBe(seedSql());
  });

  it("7 blocks in chain order summing to 24h (SPEC §2.1)", () => {
    expect(DEFAULT_BLOCKS.map((b) => b.key)).toEqual([
      "down",
      "sleep",
      "wake",
      "focus",
      "work",
      "gradation",
      "free",
    ]);
    expect(DEFAULT_BLOCKS.map((b) => b.duration_min)).toEqual([90, 450, 60, 90, 540, 60, 150]);
    expect(DEFAULT_BLOCKS.reduce((s, b) => s + b.duration_min, 0)).toBe(1440);
  });

  it("6 templates with SPEC §2.2 target wakes and fixed events", () => {
    const byKey = Object.fromEntries(DEFAULT_TEMPLATES.map((t) => [t.key, t]));
    expect(DEFAULT_TEMPLATES).toHaveLength(6);
    expect(byKey.free_weekday).toMatchObject({ weekdays: [1, 2, 5], target_wake: "10:00", fixed_events: [] });
    expect(byKey.class_wed.target_wake).toBe("07:30");
    expect(byKey.class_wed.fixed_events[0]).toMatchObject({ start: "09:00", end: "16:00" });
    expect(byKey.class_thu).toMatchObject({
      target_wake: "07:30",
      options: { attend_toggle: true, alt_target_wake: "10:00" },
    });
    expect(byKey.class_thu.fixed_events[0]).toMatchObject({ start: "09:00", end: "12:00" });
    expect(byKey.family_sun.fixed_events[0].end).toBe("20:00");
    expect(byKey.home_weekend).toMatchObject({ weekdays: [6, 7], auto_apply: false });
    // Exactly one auto-applied template per weekday.
    for (let wd = 1; wd <= 7; wd++) {
      expect(DEFAULT_TEMPLATES.filter((t) => t.auto_apply && t.weekdays.includes(wd))).toHaveLength(1);
    }
  });

  it("goal 3, gym 22:00, wake window 15, kaizen off, 6 tags", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      weekly_exercise_goal: 3,
      gym_close_time: "22:00",
      wake_window_min: 15,
    });
    expect(DEFAULT_SETTINGS.kaizen.enabled).toBe(false);
    expect(DEFAULT_SETTINGS.tags.map((t) => t.key)).toEqual([
      "yop",
      "senior_project",
      "class",
      "personal",
      "family",
      "health",
    ]);
  });
});
