import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { STARTERS } from "@/content/starters";
import en from "@/messages/en.json";
import th from "@/messages/th.json";
import {
  formatDayLong,
  formatDayShort,
  formatTime,
  formatWeekdayLong,
  formatWeekdayShort,
} from "@/lib/format";
import { saveDirty } from "@/lib/plan/patch";

const TZ = "Asia/Bangkok";

describe("format (Bangkok time, EN + TH)", () => {
  it("times are 24 h in the user's zone", () => {
    expect(formatTime(new Date("2026-11-02T19:05:00Z"), TZ)).toBe("02:05");
  });
  it("days and weekdays follow the app language", () => {
    expect(formatDayShort("2026-11-06", "en", TZ)).toBe("6 Nov");
    expect(formatWeekdayShort("2026-11-06", "en", TZ)).toBe("Fri");
    expect(formatWeekdayLong("2026-11-04", "en", TZ)).toBe("Wednesday");
    expect(formatDayLong("2026-11-06", "en", TZ)).toContain("6 November");
    expect(formatWeekdayLong("2026-11-04", "th", TZ)).toContain("พุธ");
    expect(formatDayShort("2026-11-06", "th", TZ)).toContain("พ.ย.");
  });
});

describe("starters (first-run setup)", () => {
  it.each(STARTERS.map((s) => [s.key, s] as const))(
    "%s: every weekday belongs to exactly one kind",
    (_, s) => {
      const days = s.kinds.flatMap((k) => k.weekdays).sort();
      expect(days).toEqual([1, 2, 3, 4, 5, 6, 7]);
    },
  );
  it("every kind has a name and every slot a label in EN and TH", () => {
    for (const s of STARTERS)
      for (const k of s.kinds) {
        expect((en.templates as Record<string, string>)[k.key]).toBeTruthy();
        expect((th.templates as Record<string, string>)[k.key]).toBeTruthy();
        for (const e of k.events) expect((en.fixedEvents as Record<string, string>)[e.key]).toBeTruthy();
      }
  });
});

describe("saveDirty (R-M3-4 day-plan patch)", () => {
  const row = {
    date: "2026-11-04",
    template_id: null,
    attending: null,
    bedtime_override: null,
    late_night: null,
    mode: "normal" as const,
    overrides: { blocks: { focus: { first10: "x" } } },
  };
  const fake = (rpcError: { code?: string; message?: string } | null, upsertError: unknown = null) => {
    const upsert = vi.fn().mockResolvedValue({ error: upsertError });
    const client = {
      rpc: vi.fn().mockResolvedValue({ error: rpcError }),
      from: vi.fn(() => ({ upsert })),
    } as unknown as SupabaseClient;
    return { client, upsert };
  };

  it("uses the merge RPC when it exists", async () => {
    const { client, upsert } = fake(null);
    expect(await saveDirty(client, "u", "2026-11-04", { set: { mode: "sick" } }, row)).toBe(true);
    expect(upsert).not.toHaveBeenCalled();
  });
  it("before the migration: upserts only the changed columns (+ overrides when blocks changed)", async () => {
    const { client, upsert } = fake({ code: "PGRST202", message: "Could not find patch_day_plan" });
    expect(
      await saveDirty(client, "u", "2026-11-04", { set: { mode: "sick" }, blocks: { focus: {} } }, row),
    ).toBe(true);
    expect(upsert).toHaveBeenCalledWith(
      { user_id: "u", date: "2026-11-04", mode: "sick", overrides: row.overrides },
      { onConflict: "user_id,date" },
    );
  });
  it("any other error is a failed save (kept for retry)", async () => {
    const { client } = fake({ code: "08006", message: "network" });
    expect(await saveDirty(client, "u", "2026-11-04", { set: {} }, row)).toBe(false);
  });
});
