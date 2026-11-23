import { describe, expect, it } from "vitest";
import { BIG_BUY, needsConfirm } from "@/lib/economy/confirm";

describe("big buys ask first (Minnie 2026-11-23)", () => {
  it("small buys don't ask when there's plenty left", () => {
    expect(needsConfirm(30, 1000)).toBe(false);
    expect(needsConfirm(99, 1000)).toBe(false);
  });
  it("100 coins or more always asks", () => {
    expect(needsConfirm(BIG_BUY, 10_000)).toBe(true);
    expect(needsConfirm(300, 10_000)).toBe(true);
  });
  it("a quarter or more of your coins asks, even when cheap", () => {
    expect(needsConfirm(30, 120)).toBe(true);
    expect(needsConfirm(30, 121)).toBe(false);
  });
  it("free things never ask", () => {
    expect(needsConfirm(0, 0)).toBe(false);
  });
});
