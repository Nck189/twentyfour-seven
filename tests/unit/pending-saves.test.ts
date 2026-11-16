import { describe, expect, it } from "vitest";
import { isPermanent, readPending, writePending, type PendingOp } from "@/lib/today/pendingSaves";

const mem = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    m,
  };
};
const NOW = new Date("2026-11-16T10:00:00Z");
const op = (at: string, key = "2026-11-16:work"): PendingOp => ({
  key,
  next: { block: "work" },
  req: { t: "upsert", row: { block: "work" } },
  event: ["block_started", {}],
  at,
});

describe("pending check-ins survive closing the app (M14)", () => {
  it("round-trips per user; an empty queue clears the key", () => {
    const s = mem();
    writePending(s, "u1", [op("2026-11-16T09:00:00Z")]);
    expect(readPending(s, "u1", NOW)).toHaveLength(1);
    expect(readPending(s, "u2", NOW)).toEqual([]);
    writePending(s, "u1", []);
    expect(s.m.size).toBe(0);
  });

  it("drops saves older than 7 days, malformed entries and junk", () => {
    const s = mem();
    writePending(s, "u1", [op("2026-11-01T09:00:00Z"), op("2026-11-15T09:00:00Z")]);
    expect(readPending(s, "u1", NOW).map((o) => o.at)).toEqual(["2026-11-15T09:00:00Z"]);
    s.setItem("24-7:pending-saves:u1", JSON.stringify([{ key: 1 }, "x", op("2026-11-16T08:00:00Z")]));
    expect(readPending(s, "u1", NOW)).toHaveLength(1);
    s.setItem("24-7:pending-saves:u1", "{not json");
    expect(readPending(s, "u1", NOW)).toEqual([]);
    expect(readPending(null, "u1", NOW)).toEqual([]);
  });

  it("a Postgres refusal is permanent; network/auth errors are not", () => {
    expect(isPermanent({ code: "23514", message: "check" })).toBe(true);
    expect(isPermanent({ code: "P0001" })).toBe(true);
    expect(isPermanent({ code: "", message: "TypeError: Failed to fetch" })).toBe(false);
    expect(isPermanent({ code: "PGRST301" })).toBe(false);
    expect(isPermanent(null)).toBe(false);
  });
});
