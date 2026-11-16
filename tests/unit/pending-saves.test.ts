import { describe, expect, it } from "vitest";
import {
  MAX_TRIES,
  isPermanent,
  readPending,
  replayDecision,
  writePending,
  type PendingOp,
} from "@/lib/today/pendingSaves";

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

  it("an explicit list decides what's final (G7 R-M14-1)", () => {
    // Data / integrity refusals and a request the API can't map (changed RPC or column) are final.
    for (const code of ["22023", "23505", "P0001", "PGRST202", "PGRST204", "PGRST100"])
      expect(isPermanent({ code }), code).toBe(true);
    // Auth (an expired token sent with the anon key), connection, conflicts, load, timeouts: retry.
    for (const code of ["42501", "28000", "08006", "40001", "53300", "57014", "PGRST301", "PGRST303"])
      expect(isPermanent({ code }), code).toBe(false);
  });

  it("replay: final → drop; network → stop; any other refusal is kept (not blocking) until 5 tries", () => {
    expect(replayDecision({ code: "23514" }, 0)).toBe("drop");
    expect(replayDecision({ code: "", message: "Failed to fetch" }, 0)).toBe("stop");
    expect(replayDecision(new TypeError("Failed to fetch"), 3)).toBe("stop");
    expect(replayDecision({ code: "42501" }, 0)).toBe("keep");
    expect(replayDecision({ code: "42501" }, MAX_TRIES - 2)).toBe("keep");
    expect(replayDecision({ code: "42501" }, MAX_TRIES - 1)).toBe("drop");
  });

  it("the try count survives closing the app", () => {
    const s = mem();
    writePending(s, "u1", [{ ...op("2026-11-16T09:00:00Z"), tries: 2 }]);
    expect(readPending(s, "u1", NOW)[0].tries).toBe(2);
  });
});
