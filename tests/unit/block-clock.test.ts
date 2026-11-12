import { describe, expect, it } from "vitest";
import { blockAt, storyBusy, type SavedBlock } from "@/lib/today/blockClock";

const at = (h: number, m = 0) => new Date(2026, 10, 12, h, m);
const day: SavedBlock[] = [
  { key: "wake", start: at(7).toISOString(), end: at(7, 30).toISOString() },
  { key: "focus", start: at(7, 30).toISOString(), end: at(9).toISOString() },
  { key: "work", start: at(9).toISOString(), end: at(18).toISOString() },
  { key: "free", start: at(18).toISOString(), end: at(21).toISOString() },
  { key: "down", start: at(21).toISOString(), end: at(22, 30).toISOString() },
  { key: "sleep", start: at(22, 30).toISOString(), end: new Date(2026, 10, 13, 7).toISOString() },
];

describe("block clock (G7 STORY-R6/R8: the current block on any screen)", () => {
  it("finds the block that holds now, from the saved day", () => {
    expect(blockAt(day, at(8))).toMatchObject({ key: "focus" });
    expect(blockAt(day, at(9))).toMatchObject({ key: "work" });
    expect(blockAt(day, at(21, 15))).toMatchObject({ key: "down" });
    expect(blockAt(day, new Date(2026, 10, 13, 5))).toMatchObject({ key: "sleep" });
  });

  it("nothing is known outside the saved day or with no saved day (never guesses)", () => {
    expect(blockAt(day, new Date(2026, 10, 14, 10))).toBeNull();
    expect(blockAt([], at(10))).toBeNull();
    expect(blockAt([{ key: "work", start: "nonsense", end: "x" }] as SavedBlock[], at(10))).toBeNull();
  });

  it("Som's scenes wait during the wake window and Down Time; any other block, or unknown, is calm", () => {
    expect(storyBusy(blockAt(day, at(7, 10)))).toBe(true);
    expect(storyBusy(blockAt(day, at(21, 30)))).toBe(true);
    expect(storyBusy(blockAt(day, at(12)))).toBe(false);
    expect(storyBusy(null)).toBe(false);
  });
});
