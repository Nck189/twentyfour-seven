import { describe, expect, it } from "vitest";
import { parseItem, sellPrice, orderReward, nextUpgradePrice } from "@/lib/game/market";

describe("market prices (docs/ECONOMY.md)", () => {
  it("reads crop and produce items, including pre-v2 crop stock", () => {
    expect(parseItem("crop:tomato:gold:300")).toEqual({
      kind: "crop",
      cropId: "tomato",
      quality: "gold",
      mult: 3,
    });
    expect(parseItem("crop:radish")).toEqual({ kind: "crop", cropId: "radish", quality: "normal", mult: 1 });
    expect(parseItem("produce:milk")).toEqual({ kind: "produce", id: "milk" });
    expect(parseItem("seed:corn")).toBeNull();
    expect(parseItem("crop:nope:gold:100")).toBeNull();
  });
  it("price = base × quality × weather (capped ×4) × stall bonus, rounded", () => {
    expect(sellPrice("crop:radish:normal:100", 0)).toBe(6);
    expect(sellPrice("crop:tomato:gold:300", 0)).toBe(45); // 10 × 1.5 × 3
    expect(sellPrice("crop:star_fruit:prismatic:9000", 0)).toBe(480); // 60 × 2 × 4 (cap)
    expect(sellPrice("crop:sunflower:silver:150", 2)).toBe(36); // 16 × 1.25 × 1.5 × 1.2 = 36
    expect(sellPrice("produce:truffle", 1)).toBe(13); // 12 × 1.1 = 13.2
    expect(sellPrice("seed:corn", 0)).toBeNull();
  });
  it("an order pays 1.5× the normal value + 10", () => {
    expect(orderReward("tomato", 2)).toBe(40); // 1.5 × 10 × 2 + 10
    expect(orderReward("radish", 3)).toBe(37); // 27 + 10
  });
  it("upgrades go one level at a time and stop at the top", () => {
    expect(nextUpgradePrice("stall", 0)).toBe(200);
    expect(nextUpgradePrice("stall", 1)).toBe(500);
    expect(nextUpgradePrice("stall", 2)).toBeNull();
    expect(nextUpgradePrice("house", 2)).toBe(2000);
  });
});
