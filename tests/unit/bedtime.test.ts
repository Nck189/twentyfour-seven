import { describe, expect, it } from "vitest";
import { goodnightSleep, showBedCard } from "@/lib/today/bedtime";

const bed = new Date("2026-11-10T23:00:00+07:00");
const at = (hm: string) => new Date(`2026-11-10T${hm}:00+07:00`);
const empty = { started_at: null, first10_at: null, miss_reason: null };

describe("Goodnight and tonight's Sleep (G7 R-M10-R3-1, R3-7)", () => {
  it("starts Sleep from 10 min before bedtime on, with its first-10", () => {
    expect(goodnightSleep(empty, bed, at("22:50"), true)).toEqual({ first10: true });
    expect(goodnightSleep(empty, bed, at("23:40"), true)).toEqual({ first10: true });
  });
  it("leaves Sleep alone when it's earlier (the ritual at the start of Down Time)", () => {
    expect(goodnightSleep(empty, bed, at("22:49"), true)).toBeNull();
    expect(goodnightSleep(empty, bed, at("21:30"), true)).toBeNull();
  });
  it("only starts it when Sleep has no first-10", () => {
    expect(goodnightSleep(empty, bed, at("23:00"), false)).toEqual({ first10: false });
  });
  it("never moves a start, never overrides a miss reason", () => {
    const started = { ...empty, started_at: at("22:58").toISOString() };
    expect(goodnightSleep(started, bed, at("23:05"), true)).toEqual({ first10: true });
    expect(goodnightSleep({ ...started, first10_at: started.started_at }, bed, at("23:05"), true)).toBeNull();
    expect(goodnightSleep(started, bed, at("23:05"), false)).toBeNull();
    expect(goodnightSleep({ ...empty, miss_reason: "phone" }, bed, at("23:05"), true)).toBeNull();
  });
});

describe("the Going to bed card", () => {
  it("shows after the ritual from 30 min before bedtime until Sleep starts with its first-10", () => {
    expect(showBedCard(empty, bed, at("22:30"), true, "down", true)).toBe(true);
    expect(showBedCard(empty, bed, at("22:29"), true, "down", true)).toBe(false);
    expect(showBedCard(empty, bed, at("23:30"), true, "sleep", true)).toBe(true);
    expect(showBedCard(empty, bed, at("22:45"), false, "down", true)).toBe(false);
    const done = { ...empty, started_at: at("22:50").toISOString(), first10_at: at("22:50").toISOString() };
    expect(showBedCard(done, bed, at("22:55"), true, "down", true)).toBe(false);
    expect(showBedCard({ ...empty, miss_reason: "phone" }, bed, at("23:30"), true, "sleep", true)).toBe(
      false,
    );
    expect(showBedCard(empty, bed, at("12:00"), true, "work", true)).toBe(false);
    // Started but its first-10 not ticked yet: still there for the tick; none to tick: gone.
    const started = { ...empty, started_at: at("22:50").toISOString() };
    expect(showBedCard(started, bed, at("22:55"), true, "down", true)).toBe(true);
    expect(showBedCard(started, bed, at("22:55"), true, "down", false)).toBe(false);
  });
});
